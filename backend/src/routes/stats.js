// Routes des statistiques / tableaux de bord.
import { Router } from "express";
import {
  perimetreDepartement,
  requireAdmin,
  requireAuth,
  requirePermission,
} from "../middleware/auth.js";
import { statsAdmin, statsEmploye } from "../services/stats.js";
import { statistiquesAvancees } from "../services/statsAvancees.js";
import { statistiquesExcel, statistiquesPdf } from "../services/statsExport.js";

export const statsRouter = Router();

const MIME_PDF = "application/pdf";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const dateOk = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

statsRouter.get("/employe", requireAuth, async (req, res) => {
  res.json(await statsEmploye(req.user.id));
});

statsRouter.get("/admin", requireAuth, requireAdmin, async (req, res) => {
  // Cloisonné : l'admin ne voit que son département, le super admin voit tout.
  res.json(await statsAdmin(perimetreDepartement(req.user)));
});

// Valide la période passée en query (?date_debut&date_fin).
function periode(req, res) {
  const { date_debut, date_fin } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
    return null;
  }
  if (date_fin < date_debut) {
    res.status(400).json({ detail: "La date de fin doit être postérieure à la date de début." });
    return null;
  }
  return { date_debut, date_fin };
}

// GET /api/stats/avancees — statistiques détaillées (droit « Consulter les statistiques »).
statsRouter.get("/avancees", requireAuth, requirePermission("STATISTIQUES_VOIR"), async (req, res) => {
  const p = periode(req, res);
  if (!p) return;
  res.json(await statistiquesAvancees(p.date_debut, p.date_fin, perimetreDepartement(req.user)));
});

// GET /api/stats/export?format=excel|pdf — export des statistiques.
statsRouter.get("/export", requireAuth, requirePermission("STATISTIQUES_VOIR"), async (req, res) => {
  const p = periode(req, res);
  if (!p) return;
  const format = req.query.format === "excel" ? "excel" : "pdf";
  const st = await statistiquesAvancees(p.date_debut, p.date_fin, perimetreDepartement(req.user));
  const base = `statistiques-${p.date_debut}_${p.date_fin}`;

  const buffer = format === "excel" ? await statistiquesExcel(st) : await statistiquesPdf(st);
  res.setHeader("Content-Type", format === "excel" ? MIME_XLSX : MIME_PDF);
  res.setHeader("Content-Disposition", `attachment; filename="${base}.${format === "excel" ? "xlsx" : "pdf"}"`);
  res.send(buffer);
});
