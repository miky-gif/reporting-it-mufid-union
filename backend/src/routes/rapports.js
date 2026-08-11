// Routes de génération des rapports individuels et consolidés (Word / PDF / Excel).
// Le rapport individuel consolidé est réservé à l'ADMIN ; chaque IT peut
// télécharger SON propre rapport (route /mien).
import { Router } from "express";
import { Departement, User } from "../models/index.js";
import {
  accedeDepartement,
  perimetreDepartement,
  requireAuth,
  requirePermission,
} from "../middleware/auth.js";
import { rapportConsolideHebdo, rapportHebdo } from "../services/rapportsData.js";
import { rapportConsolideHebdoPdf, rapportHebdoPdf } from "../services/rapportsPdf.js";
import { rapportConsolideHebdoWord, rapportHebdoWord } from "../services/rapportsWord.js";
import { rapportConsolideHebdoExcel, rapportHebdoExcel } from "../services/rapportsExcel.js";
import { slugAscii } from "../utils.js";

export const rapportsRouter = Router();
rapportsRouter.use(requireAuth); // requireAdmin appliqué route par route

const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function envoyerFichier(res, buffer, nom, mime) {
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Disposition", `attachment; filename="${nom}"`);
  res.send(buffer);
}

const dateOk = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
// Drapeau de requête : « inclure le 2e tableau (activités à mener) ». Faux par défaut.
const flagVrai = (v) => v === "1" || v === "true" || v === "on";

/**
 * Détermine le périmètre du rapport consolidé.
 * Un utilisateur multi-départements (super admin ou superviseur) peut cibler
 * UN département précis (paramètre departement_id) ; sinon on prend TOUT son
 * périmètre. On vérifie toujours qu'il a le droit d'accéder au département visé.
 * Renvoie { ok, scope } — scope = null (tout) ou une liste d'identifiants.
 */
async function resoudreScopeConsolide(user, departementIdParam, res) {
  if (departementIdParam === undefined || departementIdParam === "" || departementIdParam === "toutes") {
    return { ok: true, scope: perimetreDepartement(user) }; // tout le périmètre
  }
  const id = Number(departementIdParam);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ detail: "Département invalide." });
    return { ok: false };
  }
  if (!accedeDepartement(user, id)) {
    res.status(403).json({ detail: "Ce département n'appartient pas à votre périmètre." });
    return { ok: false };
  }
  const dep = await Departement.findByPk(id);
  if (!dep) {
    res.status(404).json({ detail: "Département introuvable." });
    return { ok: false };
  }
  return { ok: true, scope: [id] };
}

// Génère et envoie le rapport individuel d'un utilisateur donné.
// `inclureAMener` : ajoute le 2e tableau (activités à mener). Faux par défaut.
async function envoyerRapportIndividuel(res, user, date_debut, date_fin, format, inclureAMener = false) {
  const rap = await rapportHebdo(user, date_debut, date_fin);
  const base = `rapport-${slugAscii(user.nom_complet)}-${date_debut}_${date_fin}`;
  if (format === "word") return envoyerFichier(res, await rapportHebdoWord(rap, inclureAMener), `${base}.docx`, MIME_DOCX);
  if (format === "excel") return envoyerFichier(res, await rapportHebdoExcel(rap, inclureAMener), `${base}.xlsx`, MIME_XLSX);
  return envoyerFichier(res, await rapportHebdoPdf(rap, inclureAMener), `${base}.pdf`, MIME_PDF);
}

// GET /rapports/mien — l'IT télécharge SON propre rapport d'activité.
rapportsRouter.get("/mien", async (req, res) => {
  const { date_debut, date_fin, format = "pdf", inclure_a_mener } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  if (date_fin < date_debut) {
    return res.status(400).json({ detail: "La date de fin doit être postérieure à la date de début." });
  }
  await envoyerRapportIndividuel(res, req.user, date_debut, date_fin, format, flagVrai(inclure_a_mener));
});

// GET /rapports/mien/apercu — aperçu JSON du PROPRE rapport de l'IT (sans droit particulier).
rapportsRouter.get("/mien/apercu", async (req, res) => {
  const { date_debut, date_fin } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  const user = req.user;
  const rap = await rapportHebdo(user, date_debut, date_fin);
  res.json({
    user: { id: user.id, nom_complet: user.nom_complet, poste: user.poste, email: user.email },
    periode: rap.periode,
    type_label: rap.type_label,
    suivant_label: rap.suivant_label,
    reference: rap.reference,
    departement: rap.departement,
    debut_court: rap.debut_court,
    fin_court: rap.fin_court,
    debut_suivant_court: rap.debut_suivant_court,
    fin_suivant_court: rap.fin_suivant_court,
    nb_activites: rap.nb_activites,
    nb_a_mener: rap.nb_a_mener,
    groupes: rap.groupes,
    groupes_a_mener: rap.groupes_a_mener,
  });
});

// GET /rapports/individuel — ADMIN, pour n'importe quel agent
rapportsRouter.get("/individuel", requirePermission("RAPPORTS_EXPORTER"), async (req, res) => {
  const { user_id, date_debut, date_fin, format = "pdf", inclure_a_mener } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  if (date_fin < date_debut) {
    return res.status(400).json({ detail: "La date de fin doit être postérieure à la date de début." });
  }
  const user = await User.findByPk(Number(user_id));
  if (!user) return res.status(404).json({ detail: "Employé introuvable." });
  // Cloisonnement : un admin ne sort que les rapports de son département.
  if (!accedeDepartement(req.user, user.departement_id)) {
    return res.status(403).json({ detail: "Cet agent n'appartient pas à votre département." });
  }
  await envoyerRapportIndividuel(res, user, date_debut, date_fin, format, flagVrai(inclure_a_mener));
});

// GET /rapports/consolide
rapportsRouter.get("/consolide", requirePermission("RAPPORTS_EXPORTER"), async (req, res) => {
  const { date_debut, date_fin, departement_id, format = "pdf", inclure_a_mener } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  if (date_fin < date_debut) {
    return res.status(400).json({ detail: "La date de fin doit être postérieure à la date de début." });
  }
  const s = await resoudreScopeConsolide(req.user, departement_id, res);
  if (!s.ok) return;
  const inclureAMener = flagVrai(inclure_a_mener);
  const rap = await rapportConsolideHebdo(date_debut, date_fin, s.scope);
  const base = `rapport-consolide-${date_debut}_${date_fin}`;
  if (format === "word") {
    return envoyerFichier(res, await rapportConsolideHebdoWord(rap, inclureAMener), `${base}.docx`, MIME_DOCX);
  }
  if (format === "excel") {
    return envoyerFichier(res, await rapportConsolideHebdoExcel(rap, inclureAMener), `${base}.xlsx`, MIME_XLSX);
  }
  return envoyerFichier(res, await rapportConsolideHebdoPdf(rap, inclureAMener), `${base}.pdf`, MIME_PDF);
});

// GET /rapports/individuel/apercu — aperçu JSON pour l'écran (ADMIN)
rapportsRouter.get("/individuel/apercu", requirePermission("RAPPORTS_EXPORTER"), async (req, res) => {
  const { user_id, date_debut, date_fin } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  const user = await User.findByPk(Number(user_id));
  if (!user) return res.status(404).json({ detail: "Employé introuvable." });
  // Cloisonnement : un admin ne sort que les rapports de son département.
  if (!accedeDepartement(req.user, user.departement_id)) {
    return res.status(403).json({ detail: "Cet agent n'appartient pas à votre département." });
  }
  const rap = await rapportHebdo(user, date_debut, date_fin);
  res.json({
    user: { id: user.id, nom_complet: user.nom_complet, poste: user.poste, email: user.email },
    periode: rap.periode,
    type_label: rap.type_label,
    suivant_label: rap.suivant_label,
    reference: rap.reference,
    departement: rap.departement,
    debut_court: rap.debut_court,
    fin_court: rap.fin_court,
    debut_suivant_court: rap.debut_suivant_court,
    fin_suivant_court: rap.fin_suivant_court,
    nb_activites: rap.nb_activites,
    nb_a_mener: rap.nb_a_mener,
    groupes: rap.groupes,
    groupes_a_mener: rap.groupes_a_mener,
  });
});

// GET /rapports/consolide/apercu — aperçu JSON pour l'écran (ADMIN)
rapportsRouter.get("/consolide/apercu", requirePermission("RAPPORTS_EXPORTER"), async (req, res) => {
  const { date_debut, date_fin, departement_id } = req.query;
  if (!dateOk(date_debut) || !dateOk(date_fin)) {
    return res.status(400).json({ detail: "Dates requises au format AAAA-MM-JJ." });
  }
  const s = await resoudreScopeConsolide(req.user, departement_id, res);
  if (!s.ok) return;
  const rap = await rapportConsolideHebdo(date_debut, date_fin, s.scope);
  res.json({
    periode: rap.periode,
    type_label: rap.type_label,
    suivant_label: rap.suivant_label,
    reference: rap.reference,
    departement: rap.departement,
    debut_court: rap.debut_court,
    fin_court: rap.fin_court,
    debut_suivant_court: rap.debut_suivant_court,
    fin_suivant_court: rap.fin_suivant_court,
    nb_activites: rap.nb_activites,
    nb_a_mener: rap.nb_a_mener,
    nb_employes: rap.nb_employes,
    employes: rap.employes,
    employes_a_mener: rap.employes_a_mener,
  });
});
