# MUFID UNION — Plateforme de reporting d'activités IT

Application web fullstack de saisie, suivi et consolidation des activités du service
informatique de **MUFID UNION** (réseau de microfinance, zone CEMAC, régulé COBAC).
Interface entièrement en **français**, conforme à la maquette fournie.

- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS + recharts + lucide-react
- **Backend** : Node.js + Express + Sequelize + JWT + zod + pdfkit (PDF) + exceljs (Excel)
- **Base de données** : MySQL 8 (`mufid_activites`)

---

## 1. Fonctionnalités

| Rôle | Accès |
|------|-------|
| **EMPLOYE** | Saisit et gère **ses propres** activités, consulte son tableau de bord personnel. |
| **ADMIN** | Vue globale, gestion de **toutes** les activités, gestion des utilisateurs, export **PDF/Excel** des rapports individuels et consolidés. |

Écrans : Connexion · Tableau de bord employé · Saisie/liste d'activités (filtres, tri,
recherche, pagination) · Tableau de bord admin · Gestion des activités · Rapports
individuels · Rapports consolidés · Gestion des utilisateurs.

---

## 2. Prérequis

- **Node.js 18+** et npm (backend **et** frontend)
- **MySQL 8** en local

---

## 3. Base de données

**Aucune étape manuelle requise.** Il suffit que **MySQL ou MariaDB** soit démarré
(XAMPP, Laragon, WAMP…). Au premier lancement, l'API **crée automatiquement** la base
`mufid_activites`, les tables et les index de performance (`user_id`, `categorie`,
`statut`, `date_activite`).

> Le script `backend/sql/init.sql` reste fourni **à titre de référence** (schéma SQL
> complet) mais n'a pas besoin d'être exécuté.

---

## 4. Backend (Node.js / Express)

```bash
cd backend

# Dépendances
npm install

# Configuration : copiez .env.example en .env puis adaptez la connexion MySQL
copy .env.example .env      # Windows
# cp .env.example .env      # macOS / Linux
```

Éditez `backend/.env` :

```env
PORT=8000
# MariaDB/MySQL avec root SANS mot de passe (XAMPP, Laragon, WAMP) :
DATABASE_URL=mysql://root@127.0.0.1:3306/mufid_activites
# ... ou avec mot de passe : mysql://root:VOTRE_MDP@127.0.0.1:3306/mufid_activites
JWT_SECRET=une-cle-longue-et-aleatoire
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
SEED_PASSWORD=Mufid2026!
```

> **La base `mufid_activites` et les tables sont créées automatiquement** au premier
> lancement (pas besoin de passer par phpMyAdmin ni de lancer `init.sql`). Il suffit
> que le serveur MariaDB/MySQL soit démarré et que les identifiants soient corrects.

**Charger les données de démonstration** (7 utilisateurs + ~38 activités) :

```bash
npm run seed
```

**Lancer l'API** :

```bash
npm run dev      # avec rechargement automatique (nodemon)
# ou
npm start
```

- API : http://localhost:8000
- Vérification : http://localhost:8000/health

---

## 5. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Application : http://localhost:5173

> Le proxy Vite redirige `/api` vers `http://localhost:8000`. Pour cibler une autre
> URL d'API, définissez `VITE_API_URL` dans `frontend/.env`.

---

## 6. Comptes de démonstration

Tous les comptes utilisent le mot de passe défini par `SEED_PASSWORD` (défaut : `Mufid2026!`).

| Rôle | E-mail | Poste |
|------|--------|-------|
| **ADMIN** | `a.mbarga@mufidunion.cm` | Chef de service IT |
| Employé | `n.fotso@mufidunion.cm` | Développeuse senior |
| Employé | `s.nkodo@mufidunion.cm` | Ingénieur Réseau & Infra |
| Employé | `c.abena@mufidunion.cm` | Analyste Cybersécurité |
| Employé | `y.talla@mufidunion.cm` | Support & Maintenance |
| Employé | `e.ngono@mufidunion.cm` | Développeuse / Reporting |
| Employé | `b.etoa@mufidunion.cm` | Technicien Support |

---

## 7. Aperçu de l'API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/login` | Connexion (JSON) → token JWT + user |
| GET | `/auth/me` | Profil connecté |
| GET | `/activites` | Liste filtrable + paginée (`categorie`, `statut`, `priorite`, `date_debut`, `date_fin`, `recherche`, `user_id`, `page`, `taille`, `tri`, `ordre`) |
| POST/PUT/DELETE | `/activites/{id}` | CRUD (périmètre selon rôle) |
| GET | `/stats/employe` · `/stats/admin` | KPIs |
| GET/POST/PUT/DELETE | `/users` | Gestion utilisateurs (ADMIN, soft delete) |
| GET | `/rapports/individuel?user_id=&date_debut=&date_fin=&format=pdf\|excel` | Rapport individuel |
| GET | `/rapports/consolide?date_debut=&date_fin=&format=pdf\|excel` | Rapport consolidé (tout le personnel) |
| GET | `/rapports/{type}/apercu` | Aperçu JSON (pour l'écran) |

Les fichiers PDF/Excel portent l'en-tête **MUFID UNION** et la période concernée.

---

## 8. Structure du projet

```
gestion des tâches/
├── backend/
│   ├── src/
│   │   ├── index.js           # Point d'entrée (sync DB + serveur HTTP)
│   │   ├── app.js             # Application Express + CORS + routes
│   │   ├── config.js          # Configuration (.env)
│   │   ├── db.js              # Instance Sequelize (MySQL)
│   │   ├── security.js        # JWT + hachage bcrypt
│   │   ├── utils.js           # Libellés FR, références, initiales, slug
│   │   ├── validators.js      # Schémas de validation zod
│   │   ├── seed.js            # Données de démonstration
│   │   ├── verify.js          # Vérification hors base (sans MySQL)
│   │   ├── smoke-test.js      # Test de fumée HTTP (nécessite MySQL)
│   │   ├── models/            # Modèles Sequelize (User, Activite)
│   │   ├── middleware/        # auth (requireAuth, requireAdmin)
│   │   ├── routes/            # auth, activites, stats, users, rapports
│   │   └── services/          # stats, génération PDF & Excel
│   ├── sql/init.sql           # Script d'initialisation MySQL (référence)
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── main.tsx, App.tsx  # Point d'entrée + routage
    │   ├── context/           # AuthContext (JWT)
    │   ├── lib/               # api (axios), constantes, format, download
    │   ├── components/        # layout (Sidebar, Header), ui (badges, KPI…)
    │   └── pages/             # écrans employé + admin
    ├── tailwind.config.js     # Palette de la charte MUFID
    └── package.json
```

---

## 9. Vérification

**Sans MySQL** — vérifie toute la logique métier (sécurité, validation, calcul des
stats, génération PDF/Excel, utils) :

```bash
cd backend
npm run verify
```

**Avec MySQL** — test de fumée HTTP de bout en bout (auth, périmètre par rôle, CRUD,
stats, utilisateurs, export PDF/Excel). ⚠ Recrée les tables et recharge les données de
démo, à lancer sur la base de développement :

```bash
npm run smoke
```

---

## 10. Notes

- Sécurité : routes protégées par rôle (middlewares Express), validation zod
  (backend **et** frontend), messages d'erreur en français, CORS restreint au frontend.
- Variables sensibles (URL DB, secret JWT) dans `.env` (non versionné).
- La suppression d'un utilisateur est **logique** (champ `actif`) afin de conserver
  l'historique des activités — conformité et traçabilité COBAC.
