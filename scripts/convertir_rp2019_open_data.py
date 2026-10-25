"""Convertit les fichiers open data du recensement 2019 (Isee) en CSV.

Les classeurs `RP2019NC_OD_ind_*.xlsx` (individus, un ou deux par province) et
`RP2019NC_OD_logements.xlsx` font planter `readxl` sous R 4.6. Ce script lit
directement le XML des classeurs avec la bibliothèque standard de Python et
écrit deux fichiers CSV en UTF-8, sans modifier les sources :

- `data/population/rp2019_od/individus.csv` (les quatre classeurs empilés) ;
- `data/population/rp2019_od/logements.csv`.

Les cellules vides restent vides ; les valeurs sont recopiées telles qu'elles
figurent dans le classeur (les codes « 01 » à « 04 » du diplôme y sont stockés
comme des nombres). Le script vérifie que tous les classeurs d'un même fichier
partagent les mêmes colonnes et que les identifiants ne sont pas dupliqués.

Usage, depuis la racine du dépôt :

    python scripts/convertir_rp2019_open_data.py
"""

from __future__ import annotations

import csv
import re
import sys
import zipfile
from pathlib import Path
from xml.etree.ElementTree import iterparse

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SOURCE_DIR = Path("data") / "population"
OUTPUT_DIR = SOURCE_DIR / "rp2019_od"

INDIVIDUS = [
    "RP2019NC_OD_ind_Sud1.xlsx",
    "RP2019NC_OD_ind_Sud2.xlsx",
    "RP2019NC_OD_ind_Nord.xlsx",
    "RP2019NC_OD_ind_Iles.xlsx",
]
LOGEMENTS = ["RP2019NC_OD_logements.xlsx"]


def column_index(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref).group(0)
    index = 0
    for letter in letters:
        index = index * 26 + (ord(letter) - 64)
    return index - 1


def shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    strings = []
    with archive.open("xl/sharedStrings.xml") as handle:
        for _, element in iterparse(handle):
            if element.tag == NS + "si":
                strings.append("".join(t.text or "" for t in element.iter(NS + "t")))
                element.clear()
    return strings


def read_rows(path: Path):
    with zipfile.ZipFile(path) as archive:
        strings = shared_strings(archive)
        sheets = sorted(
            name
            for name in archive.namelist()
            if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", name)
        )
        if len(sheets) != 1:
            raise SystemExit(f"{path} : une seule feuille attendue, {len(sheets)} trouvées")
        with archive.open(sheets[0]) as handle:
            for _, element in iterparse(handle):
                if element.tag != NS + "row":
                    continue
                values = {}
                for cell in element.iter(NS + "c"):
                    kind = cell.get("t")
                    if kind == "inlineStr":
                        value = "".join(t.text or "" for t in cell.iter(NS + "t"))
                    else:
                        raw = cell.find(NS + "v")
                        if raw is None or raw.text is None:
                            continue
                        value = strings[int(raw.text)] if kind == "s" else raw.text
                    values[column_index(cell.get("r"))] = value
                element.clear()
                if values:
                    width = max(values) + 1
                    yield [values.get(i, "") for i in range(width)]


def convert(names: list[str], output: Path) -> None:
    header = None
    seen_ids = set()
    total = 0
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="") as out:
        writer = csv.writer(out)
        for name in names:
            path = SOURCE_DIR / name
            if not path.exists():
                raise SystemExit(
                    f"Source manquante : {path}. Voir data/population/README.md "
                    "pour le téléchargement."
                )
            rows = read_rows(path)
            file_header = next(rows)
            if header is None:
                header = file_header
                writer.writerow(header)
            elif file_header != header:
                raise SystemExit(f"{name} : colonnes différentes du premier classeur")
            id_col = header.index("ID") if "ID" in header else header.index("IDLOG")
            count = 0
            for row in rows:
                row = row + [""] * (len(header) - len(row))
                if len(row) > len(header):
                    raise SystemExit(f"{name} : ligne plus large que l'en-tête")
                key = row[id_col]
                if key in seen_ids:
                    raise SystemExit(f"{name} : identifiant dupliqué {key}")
                seen_ids.add(key)
                writer.writerow(row)
                count += 1
            print(f"{name} : {count} lignes")
            total += count
    print(f"Écrit {output} : {total} lignes, {len(header)} colonnes")


def main() -> int:
    convert(INDIVIDUS, OUTPUT_DIR / "individus.csv")
    convert(LOGEMENTS, OUTPUT_DIR / "logements.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())
