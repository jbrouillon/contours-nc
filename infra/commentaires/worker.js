// Service de commentaires de contours.nc (Cloudflare Worker + D1 + Turnstile).
// Mode d'emploi : infra/commentaires/README.md.
//
// Routes publiques :
//   GET  /api/comments?page=/posts/<slug>/   commentaires publiés d'un article
//   POST /api/comments                       nouveau commentaire, en attente de relecture
// Administration (jeton ADMIN_TOKEN) :
//   GET  /admin                              page de modération
//   GET  /api/admin/comments?status=…        liste des commentaires
//   POST /api/admin/comments/<id>            approve | reject | delete | reply

import { EmailMessage } from "cloudflare:email";
import adminPage from "./admin.html";

const PAGE_PATTERN = /^\/posts\/[a-z0-9][a-z0-9-]*\/$/;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const LIMITS = { author: 80, body: 4000, title: 300, request: 20000 };
const STATUSES = ["pending", "approved", "rejected"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/comments") {
        return withCors(request, env, await publicComments(request, env, ctx, url));
      }
      if (url.pathname.startsWith("/api/admin/")) return await adminApi(request, env, url);
      if (url.pathname === "/admin" || url.pathname === "/admin/") {
        return new Response(adminPage, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "x-frame-options": "DENY",
            "referrer-policy": "no-referrer"
          }
        });
      }
      if (url.pathname === "/") return Response.redirect("https://contours.nc/", 302);
      return json({ error: "Introuvable." }, 404);
    } catch (error) {
      console.error(error);
      return withCors(request, env, json({ error: "Erreur du serveur de commentaires." }, 500));
    }
  }
};

// ---------------------------------------------------------------------------
// Routes publiques

async function publicComments(request, env, ctx, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  if (request.method === "GET") {
    const page = url.searchParams.get("page") || "";
    if (!PAGE_PATTERN.test(page)) return json({ error: "Page inconnue." }, 400);
    const { results } = await env.DB.prepare(
      `SELECT id, author, body, created_at, reply, reply_at
         FROM comments
        WHERE page = ? AND status = 'approved'
        ORDER BY created_at ASC`
    ).bind(page).all();
    return json({ comments: results }, 200, { "cache-control": "public, max-age=30" });
  }

  if (request.method === "POST") {
    if (!isAllowedOrigin(request.headers.get("origin"), env)) {
      return json({ error: "Origine non autorisée." }, 403);
    }
    if (Number(request.headers.get("content-length") || 0) > LIMITS.request) {
      return json({ error: "Message trop long." }, 413);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ error: "Requête illisible." }, 400);
    }

    // Champ piège invisible : un robot qui le remplit reçoit une réponse normale.
    if (clean(input.website)) return json({ status: "pending" }, 202);

    const page = clean(input.page);
    const author = clean(input.author).replace(/\s+/g, " ");
    const body = clean(input.body).replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n");
    const pageTitle = clean(input.page_title).slice(0, LIMITS.title);

    if (!PAGE_PATTERN.test(page)) return json({ error: "Page inconnue." }, 400);
    if (author.length < 2 || author.length > LIMITS.author) {
      return json({ error: `Le nom doit compter entre 2 et ${LIMITS.author} caractères.` }, 400);
    }
    if (body.length < 2 || body.length > LIMITS.body) {
      return json({ error: `Le commentaire doit compter entre 2 et ${LIMITS.body} caractères.` }, 400);
    }

    const ip = request.headers.get("cf-connecting-ip") || "";
    if (!(await verifyTurnstile(env, clean(input.token), ip))) {
      return json({ error: "La vérification anti-spam a échoué. Rechargez la page et réessayez." }, 403);
    }

    const comment = {
      id: crypto.randomUUID(),
      page,
      page_title: pageTitle,
      author,
      body,
      created_at: new Date().toISOString()
    };
    await env.DB.prepare(
      `INSERT INTO comments (id, page, page_title, author, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(comment.id, page, pageTitle, author, body, comment.created_at).run();

    ctx.waitUntil(notifyAdmin(env, comment).catch((error) => console.error("notification", error)));
    return json({ status: "pending" }, 202);
  }

  return json({ error: "Méthode non autorisée." }, 405);
}

async function verifyTurnstile(env, token, ip) {
  if (!token || !env.TURNSTILE_SECRET) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form
  });
  const outcome = await response.json();
  return outcome.success === true;
}

// ---------------------------------------------------------------------------
// Administration

async function adminApi(request, env, url) {
  if (!(await isAdmin(request, env))) return json({ error: "Accès refusé." }, 401);

  if (url.pathname === "/api/admin/comments" && request.method === "GET") {
    const status = url.searchParams.get("status") || "pending";
    const where = STATUSES.includes(status) ? "WHERE status = ?" : "";
    const statement = env.DB.prepare(
      `SELECT id, page, page_title, author, body, status, created_at, reply, reply_at
         FROM comments ${where}
        ORDER BY created_at DESC
        LIMIT 500`
    );
    const { results } = await (where ? statement.bind(status) : statement).all();
    const { results: counts } = await env.DB.prepare(
      "SELECT status, COUNT(*) AS total FROM comments GROUP BY status"
    ).all();
    return json({ comments: results, counts }, 200, { "cache-control": "no-store" });
  }

  const match = url.pathname.match(/^\/api\/admin\/comments\/([0-9a-f-]{36})$/);
  if (match && request.method === "POST") {
    const id = match[1];
    const input = await request.json().catch(() => ({}));
    let statement;
    switch (input.action) {
      case "approve":
      case "reject":
        statement = env.DB.prepare("UPDATE comments SET status = ? WHERE id = ?")
          .bind(input.action === "approve" ? "approved" : "rejected", id);
        break;
      case "delete":
        statement = env.DB.prepare("DELETE FROM comments WHERE id = ?").bind(id);
        break;
      case "reply": {
        const reply = clean(input.reply).replace(/\r\n?/g, "\n").slice(0, LIMITS.body);
        statement = env.DB.prepare("UPDATE comments SET reply = ?, reply_at = ? WHERE id = ?")
          .bind(reply || null, reply ? new Date().toISOString() : null, id);
        break;
      }
      default:
        return json({ error: "Action inconnue." }, 400);
    }
    const { meta } = await statement.run();
    if (!meta.changes) return json({ error: "Commentaire introuvable." }, 404);
    return json({ ok: true });
  }

  return json({ error: "Introuvable." }, 404);
}

async function isAdmin(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !env.ADMIN_TOKEN) return false;
  const encoder = new TextEncoder();
  const [given, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(token)),
    crypto.subtle.digest("SHA-256", encoder.encode(env.ADMIN_TOKEN))
  ]);
  return crypto.subtle.timingSafeEqual(given, expected);
}

// ---------------------------------------------------------------------------
// Notification par courriel (Cloudflare Email Routing, adresse vérifiée)

async function notifyAdmin(env, comment) {
  if (!env.NOTIFY || !env.NOTIFY_FROM || !env.NOTIFY_TO) return;
  const articleUrl = `https://contours.nc${comment.page}`;
  const adminUrl = `${env.PUBLIC_URL || "https://commentaires.contours.nc"}/admin`;
  const text = [
    `Nouveau commentaire en attente sur « ${comment.page_title || comment.page} »`,
    articleUrl,
    "",
    `De : ${comment.author}`,
    "",
    comment.body,
    "",
    `Modérer : ${adminUrl}`
  ].join("\n");
  const raw = mimeMessage({
    from: env.NOTIFY_FROM,
    to: env.NOTIFY_TO,
    subject: `Commentaire à relire : ${comment.page_title || comment.page}`,
    text
  });
  await env.NOTIFY.send(new EmailMessage(env.NOTIFY_FROM, env.NOTIFY_TO, raw));
}

function mimeMessage({ from, to, subject, text }) {
  const domain = from.split("@")[1] || "contours.nc";
  return [
    `From: Commentaires contours.nc <${from}>`,
    `To: <${to}>`,
    `Subject: =?UTF-8?B?${base64(subject)}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(text).replace(/.{1,76}/g, "$&\r\n").trimEnd()
  ].join("\r\n");
}

function base64(value) {
  let binary = "";
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// Utilitaires

function clean(value) {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  const allowed = (env.ALLOWED_ORIGINS || "https://contours.nc").split(",").map((item) => item.trim());
  return allowed.includes(origin) || LOCAL_ORIGIN.test(origin);
}

function withCors(request, env, response) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin, env)) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("access-control-max-age", "86400");
  headers.append("vary", "origin");
  return new Response(response.body, { status: response.status, headers });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders }
  });
}
