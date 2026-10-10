# Commentaires des articles

Les commentaires en fin d'article sont servis par un petit service Cloudflare propre à contours.nc. Il remplace Cusdis (cusdis.com, constaté hors service le 10 octobre 2026), dont les commentaires n'ont pas été récupérés.

| Élément | Rôle |
|---|---|
| `worker.js` | Worker Cloudflare : API publique, API d'administration, alerte par courriel |
| `admin.html` | Page de modération servie sur `https://commentaires.contours.nc/admin` |
| `schema.sql` | Table D1 `comments` |
| `deploy.py` | Déploiement idempotent par l'API Cloudflare (Python standard, sans wrangler ni Node) |
| `includes/article-comments.html` | Affichage du fil et formulaire sur chaque article |
| `styles.css`, section « Commentaires des articles » | Mise en forme |

Ce dossier n'est ni rendu ni copié par Quarto.

## Fonctionnement

- Les lecteurs donnent un nom ou un pseudonyme et un message (4 000 caractères au plus). Aucun compte ni aucune adresse e-mail n'est demandé.
- Chaque commentaire est **en attente** jusqu'à sa validation dans la page de modération. Seuls les commentaires publiés sont renvoyés par l'API publique.
- Contre le spam : Cloudflare Turnstile, chargé seulement quand le lecteur utilise le formulaire, et un champ piège invisible.
- Un fil est identifié par le chemin de l'article (`/posts/<slug>/`, tiré de l'URL canonique). **Si un slug change, les commentaires restent attachés à l'ancien chemin** : mettre à jour la colonne `page` dans D1.
- La page de modération permet de publier, refuser, supprimer et ajouter une « Réponse de Contours » sous un commentaire. Elle est protégée par un jeton conservé dans `.local.json` (fichier local ignoré par Git).
- Si une adresse de notification est configurée, chaque nouveau commentaire envoie un courriel depuis `commentaires@contours.nc` via Email Routing.
- Si le service ne répond pas, la section affiche « Les commentaires sont momentanément indisponibles » avec un lien vers la page Contact.
- Données conservées : nom, message, chemin et titre de l'article, date, réponse éventuelle. Ni l'adresse IP ni l'e-mail ne sont enregistrés (l'IP est seulement transmise à Turnstile pour la vérification).

## Déploiement

### 1. Jeton d'API Cloudflare

Dans Cloudflare, aller dans *My Profile → API Tokens → Create Token → Create Custom Token* et donner les droits suivants :

| Portée | Permission | Niveau |
|---|---|---|
| Account | Workers Scripts | Edit |
| Account | D1 | Edit |
| Account | Turnstile | Edit |
| Account | Email Routing Addresses | Read |
| Zone | Zone | Read |
| Zone | DNS | Edit |
| Zone | Workers Routes | Edit |

Limiter *Account Resources* au compte concerné et *Zone Resources* à `contours.nc`, puis fixer une date d'expiration.

Enregistrer le jeton seul, sur une ligne, dans `~/.cloudflare/contours-nc-token` (sous Windows : `C:\Users\<vous>\.cloudflare\contours-nc-token`), ou dans la variable d'environnement `CLOUDFLARE_API_TOKEN`. Ne jamais le placer dans le dépôt.

### 2. Lancer le déploiement

Depuis la racine du dépôt :

```powershell
python infra/commentaires/deploy.py --dry-run                         # vérifie l'accès
python infra/commentaires/deploy.py --notify-to vous@exemple.org     # déploie
```

`--notify-to` doit être une adresse de destination **vérifiée** dans *Email → Email Routing → Destination addresses*. Elle est mémorisée dans `.local.json` ; `--notify-to none` désactive les alertes.

Le script crée ou met à jour la base D1 `contours-commentaires` (région Océanie), le schéma, le widget Turnstile, le Worker `contours-commentaires` et le domaine `commentaires.contours.nc`. Il affiche la clé de site Turnstile.

### 3. Relier le site

Au premier déploiement seulement : reporter la clé de site Turnstile dans `TURNSTILE_SITEKEY` de `includes/article-comments.html`, puis refaire un rendu complet du site.

## Entretien

- **Modération** : `https://commentaires.contours.nc/admin`, avec le jeton `admin_token` de `.local.json`.
- **Changement du code** : relancer `python infra/commentaires/deploy.py`.
- **Sauvegarde** : dans le tableau de bord Cloudflare, *D1 → contours-commentaires → Time Travel* permet de restaurer la base à une date des 30 derniers jours. Un export SQL est aussi disponible depuis l'API ou wrangler (`wrangler d1 export`).
- **Révocation** : supprimer `admin_token` de `.local.json` puis relancer le déploiement génère un nouveau jeton d'administration.
