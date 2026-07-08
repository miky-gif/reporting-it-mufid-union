// Routes des statistiques / tableaux de bord.
import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { statsAdmin, statsEmploye } from "../services/stats.js";

export const statsRouter = Router();

statsRouter.get("/employe", requireAuth, async (req, res) => {
  res.json(await statsEmploye(req.user.id));
});

statsRouter.get("/admin", requireAuth, requireAdmin, async (_req, res) => {
  res.json(await statsAdmin());
});
