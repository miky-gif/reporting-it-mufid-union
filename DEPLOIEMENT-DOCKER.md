# Déploiement de MUFID UNION sur un serveur Linux (Docker)

Manuel destiné à la personne qui déploie et exploite la plateforme. Il couvre
l'installation complète sur un serveur virtuel Linux neuf, la mise à jour, la
sauvegarde et les incidents courants.

L'architecture retenue fait tourner **3 conteneurs** :

```
Internet ──▶ proxy (Caddy, HTTPS auto)  ──▶  app (Node : API + frontend)  ──▶  db (MariaDB)
             ports 80/443 publiés            réseau interne uniquement        réseau interne uniquement
```

Un seul conteneur `app` sert à la fois l'API (`/api/...`) et le frontend
compilé — c'est le même contrat qu'en développement. `proxy` obtient et
renouvelle seul le certificat TLS (Let's Encrypt) ; `db` n'est jamais exposé
sur Internet.

---

## 1. Prérequis

- Un serveur virtuel Linux : **Ubuntu 22.04/24.04 LTS** ou **Debian 12**
  (les commandes ci-dessous supposent l'une de ces distributions).
- Minimum recommandé : **2 vCPU / 2 Go de RAM / 20 Go de disque** pour une
  centaine d'utilisateurs. Ajustez selon le volume de pièces jointes attendu.
- Un **nom de domaine** dont l'enregistrement DNS (A ou AAAA) pointe déjà vers
  l'adresse IP publique du serveur (ex. `mufid.mufidunion.cm`).
- Les ports **80** et **443** ouverts sur le pare-feu du serveur ET sur celui
  du fournisseur cloud (security group / NSG selon l'hébergeur).
- Un accès `sudo` sur le serveur, et l'URL du dépôt Git du projet.

---

## 2. Installation de Docker sur le serveur

Connectez-vous en SSH au serveur, puis :

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation de Docker Engine + Docker Compose (méthode officielle)
curl -fsSL https://get.docker.com | sudo sh

# Autoriser l'utilisateur courant à exécuter docker sans sudo (déconnexion/
# reconnexion SSH nécessaire pour que ça prenne effet)
sudo usermod -aG docker $USER
newgrp docker

# Vérification
docker --version
docker compose version
```

---

## 3. Récupération du code

```bash
sudo mkdir -p /opt/mufid-union
sudo chown $USER:$USER /opt/mufid-union
cd /opt/mufid-union

git clone https://github.com/miky-gif/reporting-it-mufid-union.git .
```

Le dépôt contient déjà, à sa racine, tout ce qu'il faut pour Docker :

| Fichier | Rôle |
|---|---|
| `Dockerfile` | Construit l'image de l'application (build frontend + backend). |
| `docker-compose.yml` | Orchestre les 3 conteneurs (`db`, `app`, `proxy`). |
| `Caddyfile` | Configuration du reverse proxy HTTPS. |
| `.env.production.example` | Modèle des variables d'environnement à renseigner. |

Il n'y a rien d'autre à écrire : l'étape suivante consiste à remplir la
configuration.

---

## 4. Configuration (`.env`)

```bash
cp .env.production.example .env
nano .env   # ou vim / votre éditeur préféré
```

Renseignez **chaque** variable. Les plus sensibles :

- **`DOMAIN`** — le nom de domaine déjà pointé vers ce serveur (ex.
  `mufid.mufidunion.cm`). Caddy s'en sert pour obtenir le certificat HTTPS.
- **`CORS_ORIGINS`** — l'URL complète en HTTPS du même domaine (ex.
  `https://mufid.mufidunion.cm`).
- **`DB_PASSWORD`** / **`DB_ROOT_PASSWORD`** — deux mots de passe forts et
  **différents** pour MariaDB. Générez-les par exemple avec :
  ```bash
  openssl rand -base64 24
  ```
- **`JWT_SECRET`** — la clé qui signe les sessions utilisateur. Générez une
  valeur aléatoire longue :
  ```bash
  openssl rand -base64 48
  ```
  ⚠️ Si cette clé change après la mise en production, **tous les
  utilisateurs sont déconnectés** (à faire une seule fois, au départ).

Les variables `SMTP_*` (notifications par e-mail) et `UPLOADS_DIR` (NAS de
l'entreprise) sont optionnelles au premier démarrage — voir les sections 8 et
9 pour les activer plus tard sans tout reconstruire.

`.env` contient des secrets : il est déjà exclu du dépôt Git
(`.gitignore`) — ne le committez jamais, et restreignez ses droits :

```bash
chmod 600 .env
```

---

## 5. Construction et démarrage

```bash
docker compose build
docker compose up -d
```

Au premier démarrage, l'application :
1. attend que MariaDB soit prête (`depends_on` + `healthcheck`) ;
2. crée la base de données si elle n'existe pas encore ;
3. crée automatiquement toutes les tables ;
4. crée les deux départements par défaut et les catégories/rubriques par
   défaut ;
5. obtient le certificat HTTPS pour `DOMAIN` (peut prendre 10 à 30 secondes
   la toute première fois).

Suivez le démarrage en direct :

```bash
docker compose logs -f app
```

Vous devez voir, entre autres :

```
✔ Base de données connectée et synchronisée.
✔ Départements initialisés (Exploitation Système, Infrastructure).
✔ Planificateur de tâches récurrentes actif (vérification horaire).
✔ MUFID UNION — Reporting IT (production) démarré.
```

Arrêtez de suivre les logs avec `Ctrl+C` (cela n'arrête pas les conteneurs).

---

## 6. Vérification

```bash
# Les 3 conteneurs doivent être "Up" (et "healthy" pour db/app)
docker compose ps

# Santé de l'API, depuis le serveur lui-même
curl -s http://localhost:8000/api/health
# -> {"statut":"ok"}
```

Puis, depuis un navigateur : `https://votre-domaine.cm` doit afficher l'écran
de connexion, avec un cadenas HTTPS valide.

---

## 7. Premier accès : créer le compte super administrateur

La base démarre **vide** (aucun utilisateur). Il n'y a pas d'inscription
publique — c'est voulu. Créez le tout premier compte, qui sera
**SUPER_ADMIN** (accès à tous les départements), avec le script dédié :

```bash
docker compose exec app node src/creer-super-admin.js \
  --nom "Prénom Nom" \
  --email "admin@mufidunion.cm" \
  --mot-de-passe "UnMotDePasseSolide!2026"
```

Ce script ne crée **qu'un seul compte** — aucune donnée de démonstration.
Il refuse s'il existe déjà un compte avec cette adresse (relancer sans risque).
Connectez-vous avec ces identifiants, puis créez les départements et les
comptes réels depuis l'interface (Super administration → Départements /
Utilisateurs).

> Une base de **démonstration** (comptes et activités fictifs, pratique pour
> une démo commerciale) reste disponible via `docker compose exec app npm
> run seed` — mais elle refuse de s'exécuter si des comptes existent déjà,
> pour ne jamais écraser des données réelles.

---

## 8. Pièces jointes : stockage local ou NAS de l'entreprise

Par défaut (`UPLOADS_DIR` vide), les fichiers sont stockés dans le volume
Docker `uploads_data`, qui **persiste** entre les redémarrages et les mises à
jour de l'application.

Pour utiliser un partage NAS existant :

1. Montez le partage sur **l'hôte** (le serveur Linux), par exemple en CIFS,
   de façon permanente via `/etc/fstab` :
   ```
   //nas-serveur/partage  /mnt/nas-mufid  cifs  credentials=/root/.nas-creds,uid=1000,gid=1000,vers=3.0  0  0
   ```
   (créez `/root/.nas-creds` avec `username=...` / `password=...`, droits
   `chmod 600`, puis `sudo mount -a` pour tester).
2. Dans `docker-compose.yml`, service `app`, décommentez la ligne de montage :
   ```yaml
   volumes:
     - uploads_data:/app/backend/uploads
     - /mnt/nas-mufid:/mnt/nas-mufid
   ```
3. Dans `.env`, renseignez `UPLOADS_DIR=/mnt/nas-mufid`.
4. Appliquez : `docker compose up -d app`.

Si le NAS devient injoignable en cours d'exploitation, l'application **bascule
automatiquement** sur le stockage local (volume `uploads_data`) sans
interruption de service, et revient au NAS dès qu'il redevient accessible.

---

## 9. E-mail (notifications)

Optionnel. Tant que `SMTP_HOST` est vide dans `.env`, les notifications
restent visibles dans la plateforme, sans envoi d'e-mail réel.

Pour l'activer : renseignez `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `MAIL_FROM` dans `.env`, puis :

```bash
docker compose up -d app
```

Chaque département peut aussi avoir sa **propre boîte d'envoi**, configurable
depuis l'interface (Super administration → Départements) — la configuration
`.env` ci-dessus sert d'expéditeur par défaut/de secours.

---

## 10. Mise à jour de l'application

```bash
cd /opt/mufid-union
git pull
docker compose build app
docker compose up -d app
```

- `db` et `proxy` ne redémarrent pas : aucune coupure côté base de données.
- Les migrations de schéma (nouvelles colonnes, nouvelles tables) s'appliquent
  **automatiquement** au démarrage du conteneur `app` — non destructif, les
  données existantes ne sont jamais effacées.
- Coupure de service : quelques secondes, le temps que le nouveau conteneur
  `app` démarre et passe l'état « healthy ».

Pour revenir en arrière en cas de problème :

```bash
git checkout <commit-ou-tag-precedent>
docker compose build app
docker compose up -d app
```

---

## 11. Sauvegarde et restauration

### Sauvegarder la base de données

```bash
docker compose exec db sh -c \
  'exec mysqldump -u root -p"$MARIADB_ROOT_PASSWORD" --single-transaction mufid_activites' \
  > sauvegarde_$(date +%F).sql
```

### Sauvegarder les pièces jointes (si stockage local, volume `uploads_data`)

```bash
docker run --rm \
  -v mufid-union_uploads_data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/uploads_$(date +%F).tar.gz -C /data .
```

(Si les fichiers sont sur le NAS, ils sont déjà sauvegardés par la politique
de sauvegarde du NAS de l'entreprise — rien à faire côté Docker.)

Automatisez ces deux commandes via une tâche cron quotidienne, en conservant
les sauvegardes hors du serveur (autre machine, stockage objet, etc.).

### Restaurer une sauvegarde de base

```bash
cat sauvegarde_2026-09-15.sql | docker compose exec -T db sh -c \
  'exec mysql -u root -p"$MARIADB_ROOT_PASSWORD" mufid_activites'
```

### Restaurer les pièces jointes

```bash
docker run --rm \
  -v mufid-union_uploads_data:/data \
  -v "$PWD":/backup \
  alpine sh -c "cd /data && tar xzf /backup/uploads_2026-09-15.tar.gz"
```

---

## 12. Exploitation courante

```bash
# État des conteneurs
docker compose ps

# Logs en direct (app / db / proxy)
docker compose logs -f app
docker compose logs -f proxy
docker compose logs -f db

# Redémarrer un seul service
docker compose restart app

# Arrêter / redémarrer toute la plateforme
docker compose down      # NE supprime PAS les volumes (données conservées)
docker compose up -d

# Ouvrir un shell dans le conteneur applicatif (diagnostic)
docker compose exec app sh
```

Les 3 services ont `restart: unless-stopped` : ils redémarrent seuls après un
reboot du serveur ou un crash, sans intervention.

---

## 13. Sécurité — points à vérifier avant la mise en production

- [ ] `.env` créé avec des mots de passe et un `JWT_SECRET` **uniques**,
      jamais ceux de l'exemple.
- [ ] `.env` en droits `600`, jamais commité.
- [ ] Le pare-feu du serveur (`ufw` ou équivalent) n'autorise que **80, 443 et
      22 (SSH)** en entrée :
      ```bash
      sudo ufw allow 22/tcp
      sudo ufw allow 80/tcp
      sudo ufw allow 443/tcp
      sudo ufw enable
      ```
- [ ] Le port 3306 (MariaDB) n'est **pas** publié vers l'extérieur (c'est déjà
      le cas par défaut dans `docker-compose.yml` — le service `db` n'a pas
      de section `ports`).
- [ ] Le premier compte `SUPER_ADMIN` créé (section 7) a un mot de passe fort,
      changé si besoin depuis « Mon profil ».
- [ ] Sauvegardes automatisées et testées (section 11) — une sauvegarde
      jamais restaurée n'est pas une sauvegarde.
- [ ] SSH sécurisé indépendamment de ce manuel (clé publique, `PermitRootLogin
      no`, `fail2ban` recommandé).

---

## 14. Dépannage

**`docker compose up -d` échoue avec une variable manquante**
→ Une variable obligatoire de `.env` (`DB_PASSWORD`, `JWT_SECRET`,
`CORS_ORIGINS`, `DB_ROOT_PASSWORD`, `DOMAIN`) est vide. Le message d'erreur
nomme la variable concernée.

**Le certificat HTTPS n'est pas délivré**
→ Vérifiez que `DOMAIN` dans `.env` pointe bien (DNS) vers l'IP de ce
serveur, et que les ports 80/443 sont ouverts (pare-feu serveur **et**
fournisseur cloud). Voir `docker compose logs proxy`.

**`app` reste `unhealthy` / redémarre en boucle**
→ `docker compose logs app` : le plus souvent une variable `DATABASE_URL`
incohérente, ou `db` pas encore prête (attendre, `depends_on` gère
normalement ce cas).

**Un IT ne reçoit pas d'e-mail de notification**
→ Normal si `SMTP_HOST` est vide (section 9). Sinon, vérifiez
`docker compose logs app` pour l'erreur SMTP exacte (souvent une
authentification refusée par le fournisseur de messagerie).

**Besoin d'exécuter une commande ponctuelle dans le conteneur**
→ `docker compose exec app node src/verify.js` (vérifications internes, sans
toucher à la base) ou `docker compose exec app sh` pour un accès libre.

---

## Annexe — variables d'environnement (`.env`)

| Variable | Obligatoire | Description |
|---|---|---|
| `DOMAIN` | ✅ | Domaine public, DNS déjà pointé vers ce serveur. |
| `CORS_ORIGINS` | ✅ | URL HTTPS complète du même domaine. |
| `DB_NAME` | — | Nom de la base (défaut `mufid_activites`). |
| `DB_USER` | — | Utilisateur applicatif MariaDB (défaut `mufid_app`). |
| `DB_PASSWORD` | ✅ | Mot de passe de `DB_USER`. |
| `DB_ROOT_PASSWORD` | ✅ | Mot de passe root MariaDB (sauvegardes/maintenance). |
| `JWT_SECRET` | ✅ | Clé de signature des sessions. Aléatoire, ≥ 32 caractères. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | Durée de session (défaut 480 = 8 h). |
| `SEED_PASSWORD` | — | Mot de passe des comptes de démo (`npm run seed`). |
| `UPLOADS_DIR` | — | Vide = stockage local. Sinon, chemin du NAS monté (section 8). |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `MAIL_FROM` | — | Envoi d'e-mail (section 9). Vide = désactivé. |
