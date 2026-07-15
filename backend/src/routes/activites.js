// Routes CRUD des activités, avec filtres, recherche et pagination.
// Règle : un EMPLOYE ne voit/modifie que ses propres activités ; l'ADMIN voit tout.
import { randomUUID } from "crypto";
import { Router } from "express";
import { Op } from "sequelize";
import { Activite, PieceJointe, PRIORITES, STATUTS, User } from "../models/index.js";
import {
  estAdministration,
  estSuperAdmin,
  peut,
  requireAdmin,
  requireAuth,
  requirePermission,
} from "../middleware/auth.js";
import { ajouterIntervalle, serialiserActivite } from "../utils.js";
import {
  activiteCreateSchema,
  activiteUpdateSchema,
  reaffecterSchema,
  valider,
} from "../validators.js";
import {
  notifierAffectation,
  notifierChangementStatut,
  notifierModificationTache,
  notifierNouvelleTacheEmploye,
  notifierReaffectation,
  notifierRetraitTache,
  notifierSuppressionTache,
} from "../services/notifications.js";
import { categorieActiveExiste } from "../services/categoriesStore.js";
import { upload, DOSSIER_UPLOADS } from "../services/uploads.js";
import { existsSync, unlink } from "fs";
import path from "path";

// Les notifications ne doivent jamais faire échouer l'action métier.
async function sansErreur(promesse, contexte) {
  try {
    await promesse;
  } catch (e) {
    console.error(`✖ Notification (${contexte}) non envoyée :`, e.message);
  }
}

export const activitesRouter = Router();
activitesRouter.use(requireAuth);

const COLONNES_TRI = new Set([
  "date_activite", "titre", "duree_minutes", "duree_heures", "priorite", "statut", "id",
]);

// Champs qu'un employé peut modifier sur une tâche AFFECTÉE par l'admin.
// (Il peut renseigner l'état d'exécution mais pas les consignes ni le cadrage.)
const CHAMPS_EMPLOYE_TACHE_ASSIGNEE = ["statut", "pourcentage", "description", "livrable", "activites_a_mener"];

// Garde en cohérence la durée en heures (dérivée) avec la durée en minutes.
function synchroniserDuree(donnees) {
  if (donnees.duree_minutes !== undefined) {
    donnees.duree_heures = Math.round((donnees.duree_minutes / 60) * 100) / 100;
  }
  return donnees;
}

// L'échéance (date_activite) suit la fin de période, pour le tri/retard/rapports.
function synchroniserPeriode(donnees) {
  if (donnees.date_fin) donnees.date_activite = donnees.date_fin;
  return donnees;
}

// Prépare les champs de récurrence : calcule la prochaine génération à partir
// d'une date d'ancrage (le début de la tâche), ou remet à zéro si « Aucune ».
function initialiserRecurrence(donnees, ancre) {
  if (donnees.recurrence && donnees.recurrence !== "AUCUNE" && ancre) {
    donnees.recurrence_prochaine = ajouterIntervalle(ancre, donnees.recurrence, 1);
    donnees.recurrence_active = true;
  } else if (donnees.recurrence !== undefined) {
    donnees.recurrence = "AUCUNE";
    donnees.recurrence_prochaine = null;
    donnees.recurrence_fin = null;
  }
  return donnees;
}

// Charge une activité en vérifiant le périmètre selon le rôle.
async function chargerOu404(id, user, res) {
  const activite = await Activite.findByPk(id, {
    include: [
      { model: User, as: "user" },
      { model: PieceJointe, as: "pieces" },
    ],
  });
  if (!activite) {
    res.status(404).json({ detail: "Activité introuvable." });
    return null;
  }
  // IT : uniquement les siennes. Admin : uniquement son département.
  const horsPerimetre = estAdministration(user)
    ? !estSuperAdmin(user) && activite.departement_id !== user.departement_id
    : activite.user_id !== user.id;
  if (horsPerimetre) {
    res.status(404).json({ detail: "Activité introuvable." });
    return null;
  }
  return activite;
}

// Recharge une activité complète (auteur + pièces jointes) pour la réponse.
function chargerComplet(id) {
  return Activite.findByPk(id, {
    include: [
      { model: User, as: "user" },
      { model: PieceJointe, as: "pieces" },
    ],
  });
}

// GET /activites — liste filtrée + paginée
activitesRouter.get("/", async (req, res) => {
  const {
    user_id,
    categorie,
    statut,
    priorite,
    date_debut,
    date_fin,
    recherche,
    tri = "date_activite",
    ordre = "desc",
  } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const taille = Math.min(100, Math.max(1, Number(req.query.taille) || 10));

  // Cloisonnement : l'IT ne voit que les siennes ; l'admin, celles de SON
  // département ; le super admin, toutes.
  const where = {};
  if (estAdministration(req.user)) {
    if (!estSuperAdmin(req.user)) where.departement_id = req.user.departement_id ?? -1;
    if (user_id) where.user_id = Number(user_id);
  } else {
    where.user_id = req.user.id;
  }
  if (categorie) where.categorie = categorie; // code de catégorie (dynamique)
  if (statut === "EN_RETARD") {
    // Pseudo-statut : échéance dépassée et tâche ni terminée ni clôturée.
    const auj = new Date().toISOString().slice(0, 10);
    where.date_activite = { [Op.lt]: auj };
    where.statut = { [Op.notIn]: ["TERMINE", "CLOTURE"] };
  } else if (statut && STATUTS.includes(statut)) {
    where.statut = statut;
  }
  if (priorite && PRIORITES.includes(priorite)) where.priorite = priorite;
  if (date_debut || date_fin) {
    // Fusionne avec une éventuelle contrainte posée par le filtre « En retard ».
    where.date_activite = { ...(where.date_activite || {}) };
    if (date_debut) where.date_activite[Op.gte] = date_debut;
    if (date_fin) where.date_activite[Op.lte] = date_fin;
  }
  if (recherche) {
    const motif = `%${String(recherche).trim()}%`;
    where[Op.or] = [{ titre: { [Op.like]: motif } }, { description: { [Op.like]: motif } }];
  }

  const colonne = COLONNES_TRI.has(tri) ? tri : "date_activite";
  const sens = ordre === "asc" ? "ASC" : "DESC";

  const { rows, count } = await Activite.findAndCountAll({
    where,
    include: { model: User, as: "user" },
    order: [
      [colonne, sens],
      ["id", "DESC"],
    ],
    offset: (page - 1) * taille,
    limit: taille,
  });

  res.json({
    items: rows.map(serialiserActivite),
    total: count,
    page,
    taille,
    total_pages: Math.max(1, Math.ceil(count / taille)),
  });
});

// POST /activites
activitesRouter.post("/", async (req, res) => {
  const v = valider(activiteCreateSchema, req.body, res);
  if (!v.ok) return;
  const { user_id, user_ids, ...donnees } = v.data;
  synchroniserDuree(donnees);
  synchroniserPeriode(donnees);
  initialiserRecurrence(donnees, donnees.date_debut);

  // La catégorie doit correspondre à une catégorie active.
  if (!(await categorieActiveExiste(donnees.categorie))) {
    return res.status(400).json({ detail: "Catégorie inconnue ou désactivée." });
  }

  // Les statuts « À faire » et « Clôturé » sont réservés à l'administrateur.
  if (!estAdministration(req.user) && (donnees.statut === "A_FAIRE" || donnees.statut === "CLOTURE")) {
    return res.status(400).json({
      detail: "Les statuts « À faire » et « Clôturé » sont réservés à l'administrateur.",
    });
  }

  // Détermine la liste des destinataires (affectation simple ou multiple).
  let cibles = [];
  const idsDemandes = [...new Set([...(user_ids || []), ...(user_id ? [user_id] : [])])].filter(
    (id) => id && id !== req.user.id,
  );
  if (idsDemandes.length > 0) {
    if (!estAdministration(req.user)) {
      return res.status(403).json({ detail: "Vous ne pouvez créer que vos propres activités." });
    }
    if (!peut(req.user, "TACHES_AFFECTER")) {
      return res.status(403).json({ detail: "Droit manquant : « Affecter des tâches »." });
    }
    cibles = await User.findAll({ where: { id: idsDemandes, actif: true } });
    if (cibles.length === 0) {
      return res.status(404).json({ detail: "Aucun employé cible valide." });
    }
    // Cloisonnement : un admin n'affecte qu'aux agents de SON département.
    if (!estSuperAdmin(req.user)) {
      const horsDep = cibles.filter((c) => c.departement_id !== req.user.departement_id);
      if (horsDep.length > 0) {
        return res.status(403).json({
          detail: "Vous ne pouvez affecter des tâches qu'aux agents de votre département.",
        });
      }
    }
  }

  // Création : soit pour soi-même, soit une instance par agent affecté.
  const affectation = cibles.length > 0;
  const groupeId = cibles.length > 1 ? randomUUID() : null;
  const cibleUsers = affectation ? cibles : [req.user];

  const creees = [];
  for (const cible of cibleUsers) {
    const a = await Activite.create({
      ...donnees,
      user_id: cible.id,
      departement_id: cible.departement_id ?? null, // l'activité suit l'agent
      assignee_par_admin: affectation,
      groupe_affectation_id: groupeId,
    });
    const complet = await chargerComplet(a.id);
    creees.push(complet);

    if (affectation) {
      await sansErreur(
        notifierAffectation({ destinataire: cible, admin: req.user, activite: complet }),
        "affectation",
      );
    }
  }

  // Un employé a créé sa propre activité -> alerte des administrateurs.
  if (!affectation && !estAdministration(req.user)) {
    await sansErreur(
      notifierNouvelleTacheEmploye({ auteur: req.user, activite: creees[0] }),
      "nouvelle tâche employé",
    );
  }

  // Réponse : l'activité créée (ou la 1re instance en cas d'affectation multiple).
  res.status(201).json(serialiserActivite(creees[0]));
});

// GET /activites/:id
activitesRouter.get("/:id", async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) return;
  res.json(serialiserActivite(activite));
});

// PUT /activites/:id
activitesRouter.put("/:id", async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) return;
  const v = valider(activiteUpdateSchema, req.body, res);
  if (!v.ok) return;

  const estAdmin = estAdministration(req.user);

  // Le statut « Clôturé » ne peut être posé que par l'administration (validation finale).
  if (!estAdmin && v.data.statut === "CLOTURE") {
    return res.status(403).json({ detail: "Seul un administrateur peut clôturer une tâche." });
  }
  // Droits granulaires de l'administration.
  if (estAdmin) {
    const cloture = v.data.statut === "CLOTURE" && activite.statut !== "CLOTURE";
    if (cloture && !peut(req.user, "TACHES_CLOTURER")) {
      return res.status(403).json({ detail: "Droit manquant : « Clôturer (valider) les tâches »." });
    }
    // Modifier la tâche d'un agent nécessite le droit correspondant.
    if (activite.user_id !== req.user.id && !peut(req.user, "TACHES_MODIFIER")) {
      return res.status(403).json({ detail: "Droit manquant : « Modifier les tâches »." });
    }
  }

  // Périmètre de modification côté employé.
  let donnees = { ...v.data };
  if (!estAdmin) {
    if (activite.assignee_par_admin) {
      // Tâche affectée : l'employé ne touche que l'état d'exécution et le statut.
      donnees = Object.fromEntries(
        Object.entries(v.data).filter(([k]) => CHAMPS_EMPLOYE_TACHE_ASSIGNEE.includes(k)),
      );
    } else {
      // Tâche personnelle : l'employé ne peut jamais poser « À faire »/« Clôturé ».
      delete donnees.consignes; // les consignes restent l'apanage de l'admin
    }
  }
  synchroniserDuree(donnees);
  synchroniserPeriode(donnees);

  // Modification de la récurrence : recalcule la prochaine génération.
  if (donnees.recurrence !== undefined) {
    if (donnees.recurrence === "AUCUNE") {
      donnees.recurrence = "AUCUNE";
      donnees.recurrence_prochaine = null;
    } else {
      const ancre = donnees.date_debut || activite.date_debut || activite.date_activite;
      // On (re)démarre le compteur seulement si la fréquence change ou n'existait pas.
      if (activite.recurrence !== donnees.recurrence || !activite.recurrence_prochaine) {
        donnees.recurrence_prochaine = ajouterIntervalle(ancre, donnees.recurrence, 1);
      }
      donnees.recurrence_active = true;
    }
  }

  // Gestion de la clôture (date + auteur) côté admin.
  const ancienStatut = activite.statut;
  if (donnees.statut === "CLOTURE" && ancienStatut !== "CLOTURE") {
    donnees.date_cloture = new Date();
    donnees.cloture_par = req.user.id;
  } else if (donnees.statut && donnees.statut !== "CLOTURE" && ancienStatut === "CLOTURE") {
    donnees.date_cloture = null;
    donnees.cloture_par = null;
  }

  // Validation de la catégorie si elle est modifiée.
  if (donnees.categorie && !(await categorieActiveExiste(donnees.categorie))) {
    return res.status(400).json({ detail: "Catégorie inconnue ou désactivée." });
  }

  const proprietaire = activite.user; // inclus par chargerOu404
  await activite.update(donnees);
  const complet = await chargerComplet(activite.id);

  const statutChange = donnees.statut && donnees.statut !== ancienStatut;
  if (!estAdministration(req.user) && statutChange) {
    // L'employé a changé le statut de sa tâche -> alerte des administrateurs.
    await sansErreur(
      notifierChangementStatut({
        auteur: req.user,
        activite: complet,
        ancienStatut,
        nouveauStatut: complet.statut,
      }),
      "changement de statut",
    );
  } else if (estAdministration(req.user) && proprietaire && proprietaire.id !== req.user.id) {
    // L'admin a modifié la tâche d'un employé -> notification interne à l'employé.
    await sansErreur(
      notifierModificationTache({ destinataire: proprietaire, admin: req.user, activite: complet }),
      "modification tâche",
    );
  }

  res.json(serialiserActivite(complet));
});

// POST /activites/:id/reaffecter — l'ADMIN confie la tâche à un autre agent
// (agent indisponible, en retard, ou non compétent sur le sujet).
activitesRouter.post("/:id/reaffecter", requirePermission("TACHES_REAFFECTER"), async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) return;

  const v = valider(reaffecterSchema, req.body, res);
  if (!v.ok) return;
  const { user_id, motif, reinitialiser, date_debut, date_fin, duree_minutes } = v.data;

  if (activite.statut === "CLOTURE") {
    return res.status(400).json({ detail: "Une tâche clôturée ne peut plus être réaffectée." });
  }
  if (user_id === activite.user_id) {
    return res.status(400).json({ detail: "Cette tâche est déjà affectée à cet agent." });
  }

  const nouveau = await User.findOne({ where: { id: user_id, actif: true } });
  if (!nouveau) return res.status(404).json({ detail: "Agent destinataire introuvable ou désactivé." });
  // Cloisonnement : on ne réaffecte qu'à un agent de son propre département.
  if (!estSuperAdmin(req.user) && nouveau.departement_id !== req.user.departement_id) {
    return res.status(403).json({
      detail: "Vous ne pouvez réaffecter qu'à un agent de votre département.",
    });
  }

  const ancien = activite.user; // inclus par chargerOu404
  const ancienId = activite.user_id;
  const motifPropre = typeof motif === "string" && motif.trim() ? motif.trim() : null;

  // Nouvelle période / durée : indispensable si la tâche était déjà en retard,
  // sinon elle resterait en retard chez le nouvel agent.
  const donnees = {
    user_id: nouveau.id,
    departement_id: nouveau.departement_id ?? null, // l'activité suit l'agent
    assignee_par_admin: true, // devient une tâche affectée par l'admin
    reaffectee_de: ancienId,
    date_reaffectation: new Date(),
    motif_reaffectation: motifPropre,
    // Repartir de zéro pour le nouvel agent (par défaut).
    ...(reinitialiser ? { statut: "A_FAIRE", pourcentage: 0 } : {}),
  };
  if (date_debut) donnees.date_debut = date_debut;
  if (date_fin) {
    donnees.date_fin = date_fin;
    donnees.date_activite = date_fin; // l'échéance suit la fin de période
  }
  if (duree_minutes !== undefined) {
    donnees.duree_minutes = duree_minutes;
    donnees.duree_heures = Math.round((duree_minutes / 60) * 100) / 100;
  }

  await activite.update(donnees);
  const complet = await chargerComplet(activite.id);

  // Le nouvel agent est prévenu (plateforme + e-mail), motif inclus.
  await sansErreur(
    notifierReaffectation({ destinataire: nouveau, ancien, admin: req.user, activite: complet, motif: motifPropre }),
    "réaffectation",
  );
  // L'ancien agent est informé du retrait (notification interne).
  if (ancien && ancien.id !== req.user.id) {
    await sansErreur(
      notifierRetraitTache({ destinataire: ancien, nouveau, admin: req.user, activite: complet, motif: motifPropre }),
      "retrait de tâche",
    );
  }

  res.json(serialiserActivite(complet));
});

// ---------------------------------------------------------------------------
// Pièces jointes
// ---------------------------------------------------------------------------

// Enveloppe multer pour renvoyer une erreur JSON propre (taille/type/…).
function televerser(req, res, next) {
  upload.single("fichier")(req, res, (err) => {
    if (err) return res.status(400).json({ detail: err.message || "Téléversement impossible." });
    next();
  });
}

// POST /activites/:id/pieces — téléverse une pièce jointe (propriétaire ou admin).
activitesRouter.post("/:id/pieces", televerser, async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) {
    if (req.file) unlink(path.join(DOSSIER_UPLOADS, req.file.filename), () => {});
    return;
  }
  if (!req.file) return res.status(400).json({ detail: "Aucun fichier reçu." });

  const piece = await PieceJointe.create({
    activite_id: activite.id,
    nom_fichier: req.file.originalname,
    fichier: req.file.filename,
    mime: req.file.mimetype,
    taille: req.file.size,
    televerse_par: req.user.id,
  });
  res.status(201).json({
    id: piece.id,
    nom_fichier: piece.nom_fichier,
    mime: piece.mime,
    taille: piece.taille,
    date_creation: piece.date_creation,
  });
});

// GET /activites/:id/pieces/:pieceId — télécharge une pièce jointe.
activitesRouter.get("/:id/pieces/:pieceId", async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) return;
  const piece = await PieceJointe.findOne({
    where: { id: Number(req.params.pieceId), activite_id: activite.id },
  });
  if (!piece) return res.status(404).json({ detail: "Pièce jointe introuvable." });
  const chemin = path.join(DOSSIER_UPLOADS, piece.fichier);
  if (!existsSync(chemin)) return res.status(404).json({ detail: "Fichier absent du serveur." });
  res.download(chemin, piece.nom_fichier);
});

// DELETE /activites/:id/pieces/:pieceId — supprime une pièce jointe.
activitesRouter.delete("/:id/pieces/:pieceId", async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) return;
  const piece = await PieceJointe.findOne({
    where: { id: Number(req.params.pieceId), activite_id: activite.id },
  });
  if (!piece) return res.status(404).json({ detail: "Pièce jointe introuvable." });
  unlink(path.join(DOSSIER_UPLOADS, piece.fichier), () => {});
  await piece.destroy();
  res.status(204).end();
});

// DELETE /activites/:id
activitesRouter.delete("/:id", async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) return;

  // Supprimer la tâche d'un agent exige le droit correspondant.
  if (
    estAdministration(req.user) &&
    activite.user_id !== req.user.id &&
    !peut(req.user, "TACHES_SUPPRIMER")
  ) {
    return res.status(403).json({ detail: "Droit manquant : « Supprimer des tâches »." });
  }

  const proprietaire = activite.user;
  const snapshot = { titre: activite.titre };
  await activite.destroy();

  // L'admin a supprimé la tâche d'un employé -> notification interne à l'employé.
  if (estAdministration(req.user) && proprietaire && proprietaire.id !== req.user.id) {
    await sansErreur(
      notifierSuppressionTache({ destinataire: proprietaire, admin: req.user, activite: snapshot }),
      "suppression tâche",
    );
  }
  res.status(204).end();
});
