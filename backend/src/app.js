// Application Express (montée des routes, CORS, gestion d'erreurs).
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

export function creerApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json());

  app.get("/", (_req, res) =>
    res.json({ application: "MUFID UNION — Reporting IT", version: "1.0.0", statut: "ok" }),
  );
  app.get("/health", (_req, res) => res.json({ statut: "ok" }));

  app.use("/auth", authRouter);
  app.use("/activites", activitesRouter);
  app.use("/stats", statsRouter);
  app.use("/users", usersRouter);
  app.use("/rapports", rapportsRouter);
  app.use("/notifications", notificationsRouter);
  app.use("/categories", categoriesRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ detail: "Ressource introuvable." }));

  // Gestionnaire d'erreurs global
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ detail: "Erreur interne du serveur." });
  });

  return app;
}
