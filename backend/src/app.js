// Application Express : API sous /api + service du frontend compilé (production).
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { authRouter } from "./routes/auth.js";
import { activitesRouter } from "./routes/activites.js";
import { statsRouter } from "./routes/stats.js";
import { usersRouter } from "./routes/users.js";
import { rapportsRouter } from "./routes/rapports.js";
import { notificationsRouter } from "./routes/notifications.js";
import { categoriesRouter } from "./routes/categories.js";
import { departementsRouter } from "./routes/departements.js";

// Emplacement du build du frontend (généré par `npm run build` côté frontend).
// Résolu depuis ce fichier (et non depuis cwd) : robuste quel que soit le
// répertoire de lancement (PM2, service Windows, npm start…).
const ICI = path.dirname(fileURLToPath(import.meta.url)); // backend/src
const DIST = path.resolve(ICI, "../../frontend/dist");
const INDEX_HTML = path.join(DIST, "index.html");

export function creerApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json());

  // ---------------------------------------------------------------------
  // API — toutes les routes sont préfixées par /api pour ne pas entrer en
  // collision avec les routes du frontend (SPA) servies à la racine.
  // ---------------------------------------------------------------------
  app.get("/api", (_req, res) =>
    res.json({ application: "MUFID UNION — Reporting IT", version: "2.0.0", statut: "ok" }),
  );
  app.get("/api/health", (_req, res) => res.json({ statut: "ok" }));

  app.use("/api/auth", authRouter);
  app.use("/api/activites", activitesRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/rapports", rapportsRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/departements", departementsRouter);

  // 404 des routes API (avant le fallback SPA).
  app.use("/api", (_req, res) => res.status(404).json({ detail: "Ressource introuvable." }));

  // ---------------------------------------------------------------------
  // Frontend — sert le build s'il existe (déploiement mono-process).
  // Toute route non-API renvoie index.html (routage côté client).
  // ---------------------------------------------------------------------
  if (existsSync(INDEX_HTML)) {
    app.use(express.static(DIST, { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(INDEX_HTML));
  } else {
    app.get("/", (_req, res) =>
      res.json({
        application: "MUFID UNION — Reporting IT (API)",
        note: "Frontend non compilé. En dev, utilisez le serveur Vite (npm run dev côté frontend).",
      }),
    );
    app.use((_req, res) => res.status(404).json({ detail: "Ressource introuvable." }));
  }

  // Gestionnaire d'erreurs global
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ detail: "Erreur interne du serveur." });
  });

  return app;
}
