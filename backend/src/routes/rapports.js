// Routes de génération des rapports individuels et consolidés (PDF / Excel).
// Accès réservé à l'ADMIN.
import { Router } from "express";
import { User } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { rapportConsolideHebdo, rapportHebdo } from "../services/rapportsData.js";
import { rapportConsolideHebdoPdf, rapportHebdoPdf } from "../services/rapportsPdf.js";
import { rapportConsolideHebdoWord, rapportHebdoWord } from "../services/rapportsWord.js";
import { slugAscii } from "../utils.js";

export const rapportsRouter = Router();
rapportsRouter.use(requireAuth, requireAdmin);

const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function envoyerFichier(res, buffer, nom, mime) {
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${nom}"`);
  res.send(buffer);
}

const dateOk = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

// GET /rapports/individuel
rapportsRouter.get("/individuel", async (req, res) => {
  const { user_id, date_debut, date_fin, format = "pdf" } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  if (date_fin < date_debut) {
    return res.status(400).json({ detail: "La date de fin doit être postérieure à la date de début." });
  }
  const user = await User.findByPk(Number(user_id));
  if (!user) return res.status(404).json({ detail: "Employé introuvable." });

  const rap = await rapportHebdo(user, date_debut, date_fin);
  const base = `rapport-${slugAscii(user.nom_complet)}-${date_debut}_${date_fin}`;
  if (format === "word") {
    return envoyerFichier(res, await rapportHebdoWord(rap), `${base}.docx`, MIME_DOCX);
  }
  return envoyerFichier(res, await rapportHebdoPdf(rap), `${base}.pdf`, MIME_PDF);
});

// GET /rapports/consolide
rapportsRouter.get("/consolide", async (req, res) => {
  const { date_debut, date_fin, format = "pdf" } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  if (date_fin < date_debut) {
    return res.status(400).json({ detail: "La date de fin doit être postérieure à la date de début." });
  }
  const rap = await rapportConsolideHebdo(date_debut, date_fin);
  const base = `rapport-consolide-${date_debut}_${date_fin}`;
  if (format === "word") {
    return envoyerFichier(res, await rapportConsolideHebdoWord(rap), `${base}.docx`, MIME_DOCX);
  }
  return envoyerFichier(res, await rapportConsolideHebdoPdf(rap), `${base}.pdf`, MIME_PDF);
});

// GET /rapports/individuel/apercu — aperçu JSON pour l'écran
rapportsRouter.get("/individuel/apercu", async (req, res) => {
  const { user_id, date_debut, date_fin } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  const user = await User.findByPk(Number(user_id));
  if (!user) return res.status(404).json({ detail: "Employé introuvable." });
  const rap = await rapportHebdo(user, date_debut, date_fin);
  res.json({
    user: { id: user.id, nom_complet: user.nom_complet, poste: user.poste, email: user.email },
    periode: rap.periode,
    reference: rap.reference,
    departement: rap.departement,
    debut_court: rap.debut_court,
    fin_court: rap.fin_court,
    nb_activites: rap.nb_activites,
    groupes: rap.groupes,
  });
});

// GET /rapports/consolide/apercu — aperçu JSON pour l'écran
rapportsRouter.get("/consolide/apercu", async (req, res) => {
  const { date_debut, date_fin } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  const rap = await rapportConsolideHebdo(date_debut, date_fin);
  res.json({
    periode: rap.periode,
    reference: rap.reference,
    departement: rap.departement,
    debut_court: rap.debut_court,
    fin_court: rap.fin_court,
    nb_activites: rap.nb_activites,
    nb_employes: rap.nb_employes,
    employes: rap.employes,
  });
});
