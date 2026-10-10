"""Déploie le service de commentaires de contours.nc sur Cloudflare.

Idempotent : chaque exécution crée ce qui manque (base D1, schéma, widget
Turnstile, domaine) et republie le Worker. Aucune dépendance hors bibliothèque
standard ; wrangler/Node ne sont pas nécessaires.

Jeton d'API : variable CLOUDFLARE_API_TOKEN, sinon fichier
~/.cloudflare/contours-nc-token (une seule ligne). Voir README.md.

Usage, depuis la racine du dépôt :
    python infra/commentaires/deploy.py [--notify-to adresse@exemple.org] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOCAL_FILE = HERE / ".local.json"  # jeton d'administration et adresse de notification, hors Git
TOKEN_FILE = Path.home() / ".cloudflare" / "contours-nc-token"

ZONE = "contours.nc"
HOSTNAME = "commentaires.contours.nc"
WORKER = "contours-commentaires"
DATABASE = "contours-commentaires"
DATABASE_LOCATION = "oc"  # Océanie
TURNSTILE_NAME = "contours.nc commentaires"
TURNSTILE_DOMAINS = ["contours.nc"]
ALLOWED_ORIGINS = "https://contours.nc"
NOTIFY_FROM = "commentaires@contours.nc"
COMPATIBILITY_DATE = "2026-09-01"

API = "https://api.cloudflare.com/client/v4"


class CloudflareError(RuntimeError):
    pass


def api_token() -> str:
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not token and TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
    if not token:
        sys.exit(f"Jeton introuvable : définir CLOUDFLARE_API_TOKEN ou créer {TOKEN_FILE}.")
    return token


def call(method: str, path: str, token: str, payload=None, body: bytes | None = None,
         content_type: str = "application/json"):
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(f"{API}{path}", data=body, method=method)
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("User-Agent", "contours-nc-deploy")
    if body is not None:
        request.add_header("Content-Type", content_type)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        try:
            data = json.loads(error.read() or b"{}")
        except json.JSONDecodeError:
            data = {}
        errors = data.get("errors") or [{"message": str(error)}]
        raise CloudflareError(f"{method} {path} : " + " ; ".join(
            f"[{item.get('code', '?')}] {item.get('message')}" for item in errors)) from None
    if not data.get("success", True):
        raise CloudflareError(f"{method} {path} : {data.get('errors')}")
    return data.get("result")


def load_local() -> dict:
    if LOCAL_FILE.exists():
        return json.loads(LOCAL_FILE.read_text(encoding="utf-8"))
    return {}


def save_local(values: dict) -> None:
    LOCAL_FILE.write_text(json.dumps(values, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def schema_statements() -> list[str]:
    lines = [line.split("--", 1)[0] for line in (HERE / "schema.sql").read_text(encoding="utf-8").splitlines()]
    return [statement.strip() for statement in "\n".join(lines).split(";") if statement.strip()]


def multipart(parts: list[tuple[str, str, str, bytes]]) -> tuple[bytes, str]:
    boundary = f"----contours{uuid.uuid4().hex}"
    chunks = []
    for name, filename, content_type, content in parts:
        disposition = f'form-data; name="{name}"'
        if filename:
            disposition += f'; filename="{filename}"'
        chunks.append(
            f"--{boundary}\r\nContent-Disposition: {disposition}\r\nContent-Type: {content_type}\r\n\r\n".encode()
            + content + b"\r\n"
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--notify-to", help="adresse vérifiée dans Email Routing qui reçoit les alertes ; "
                                            "« none » pour désactiver")
    parser.add_argument("--dry-run", action="store_true", help="vérifie l'accès sans rien modifier")
    args = parser.parse_args()

    token = api_token()
    local = load_local()
    if args.notify_to is not None:
        local["notify_to"] = "" if args.notify_to.lower() == "none" else args.notify_to.strip()

    zones = call("GET", f"/zones?name={ZONE}", token)
    if not zones:
        sys.exit(f"Zone {ZONE} introuvable avec ce jeton.")
    zone_id, account_id = zones[0]["id"], zones[0]["account"]["id"]
    account = f"/accounts/{account_id}"
    print(f"Zone {ZONE} ({zone_id}), compte {zones[0]['account']['name']}")

    databases = call("GET", f"{account}/d1/database?name={DATABASE}", token) or []
    database = next((item for item in databases if item["name"] == DATABASE), None)
    widgets = call("GET", f"{account}/challenges/widgets", token) or []
    widget = next((item for item in widgets if item["name"] == TURNSTILE_NAME), None)
    print(f"Base D1 : {'existante' if database else 'à créer'} ; widget Turnstile : {'existant' if widget else 'à créer'}")

    notify_to = local.get("notify_to", "")
    if notify_to:
        addresses = call("GET", f"{account}/email/routing/addresses", token) or []
        verified = {item["email"].lower() for item in addresses if item.get("verified")}
        if notify_to.lower() not in verified:
            sys.exit(f"{notify_to} n'est pas une adresse de destination vérifiée dans Email Routing.")
        print(f"Alertes envoyées à {notify_to}")

    if args.dry_run:
        print("Simulation terminée : aucun changement.")
        return

    if not database:
        database = call("POST", f"{account}/d1/database", token,
                        {"name": DATABASE, "primary_location_hint": DATABASE_LOCATION})
    database_id = database["uuid"]
    for statement in schema_statements():
        call("POST", f"{account}/d1/database/{database_id}/query", token, {"sql": statement})
    print(f"Base D1 {DATABASE} ({database_id}) : schéma appliqué")

    if not widget:
        widget = call("POST", f"{account}/challenges/widgets", token,
                      {"name": TURNSTILE_NAME, "domains": TURNSTILE_DOMAINS, "mode": "managed"})
    else:
        widget = call("GET", f"{account}/challenges/widgets/{widget['sitekey']}", token)
    print(f"Turnstile : clé de site {widget['sitekey']}")

    if not local.get("admin_token"):
        local["admin_token"] = secrets.token_urlsafe(32)
    save_local(local)

    bindings = [
        {"type": "d1", "name": "DB", "id": database_id},
        {"type": "plain_text", "name": "ALLOWED_ORIGINS", "text": ALLOWED_ORIGINS},
        {"type": "plain_text", "name": "PUBLIC_URL", "text": f"https://{HOSTNAME}"},
        {"type": "secret_text", "name": "TURNSTILE_SECRET", "text": widget["secret"]},
        {"type": "secret_text", "name": "ADMIN_TOKEN", "text": local["admin_token"]},
    ]
    if notify_to:
        bindings += [
            {"type": "send_email", "name": "NOTIFY", "destination_address": notify_to},
            {"type": "plain_text", "name": "NOTIFY_FROM", "text": NOTIFY_FROM},
            {"type": "plain_text", "name": "NOTIFY_TO", "text": notify_to},
        ]
    metadata = {
        "main_module": "worker.js",
        "compatibility_date": COMPATIBILITY_DATE,
        "bindings": bindings,
        "observability": {"enabled": True},
    }
    body, content_type = multipart([
        ("metadata", "", "application/json", json.dumps(metadata).encode("utf-8")),
        ("worker.js", "worker.js", "application/javascript+module", (HERE / "worker.js").read_bytes()),
        ("admin.html", "admin.html", "text/plain", (HERE / "admin.html").read_bytes()),
    ])
    call("PUT", f"{account}/workers/scripts/{WORKER}", token, body=body, content_type=content_type)
    call("POST", f"{account}/workers/scripts/{WORKER}/subdomain", token, {"enabled": False})
    print(f"Worker {WORKER} publié")

    call("PUT", f"{account}/workers/domains", token, {
        "hostname": HOSTNAME, "service": WORKER, "zone_id": zone_id, "environment": "production"
    })
    print(f"Domaine : https://{HOSTNAME} (modération : https://{HOSTNAME}/admin)")
    print(f"Jeton d'administration : voir {LOCAL_FILE.relative_to(HERE.parent.parent)}")


if __name__ == "__main__":
    try:
        main()
    except CloudflareError as error:
        sys.exit(f"Erreur Cloudflare : {error}")
