# syntax=docker/dockerfile:1
#
# Image de production MUFID UNION : un seul conteneur qui sert l'API (Express)
# ET le build statique du frontend (React/Vite) — même contrat qu'en
# développement (backend/src/app.js sert frontend/dist si présent).
#
# Construction : depuis la RACINE du dépôt (le contexte doit voir backend/ ET
# frontend/ côte à côte) :
#   docker build -t mufid-union:latest .
#
# ---------------------------------------------------------------------------
# Étape 1 — build du frontend (React / Vite -> fichiers statiques)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Étape 2 — dépendances backend, PRODUCTION uniquement (pas nodemon, etc.)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Étape 3 — image finale : backend Node + build frontend statique
# (frontend/dist doit rester à côté de backend/, car app.js résout le chemin
# depuis son propre emplacement : backend/src/../../frontend/dist)
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# curl : utilisé par le HEALTHCHECK (GET /api/health)
RUN apk add --no-cache curl \
 && addgroup -S mufid && adduser -S mufid -G mufid

WORKDIR /app

# Code backend d'abord, PUIS les dépendances de prod par-dessus : si jamais
# .dockerignore ne filtrait pas un node_modules local, celui de l'étape 2
# (compilé pour Linux/Alpine) l'emporte toujours.
COPY backend/ ./backend/
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Dossier local des pièces jointes (repli automatique si le NAS est
# indisponible — voir backend/src/services/uploads.js). Recouvert par le
# volume Docker déclaré dans docker-compose.yml : persiste entre les mises à jour.
RUN mkdir -p /app/backend/uploads && chown -R mufid:mufid /app

USER mufid
ENV NODE_ENV=production
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["node", "backend/src/index.js"]
