// Routes CRUD des activités, avec filtres, recherche et pagination.
// Règle : un EMPLOYE ne voit/modifie que ses propres activités ; l'ADMIN voit tout.
import { Router } from "express";
import { Op } from "sequelize";
import { Activite, PRIORITES, STATUTS, User } from "../models/index.js";
import { requireAuth } from "../middleware/auth.js";
import { serialiserActivite } from "../utils.js";
import { activiteCreateSchema, activiteUpdateSchema, valider } from "../validators.js";
import {
  notifierAffectation,
  notifierChangementStatut,
  notifierModificationTache,
  notifierNouvelleTacheEmploye,
  notifierSuppressionTache,
} from "../services/notifications.js";
import { categorieActiveExiste } from "../services/categoriesStore.js";

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

const COLONNES_TRI = new Set(["date_activite", "titre", "duree_heures", "priorite", "statut", "id"]);

// Charge une activité en vérifiant le périmètre selon le rôle.
async function chargerOu404(id, user, res) {
  const activite = await Activite.findByPk(id, { include: { model: User, as: "user" } });
  if (!activite || (user.role !== "ADMIN" && activite.user_id !== user.id)) {
    res.status(404).json({ detail: "Activité introuvable." });
    return null;
  }
  return activite;
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

  const where = {};
  if (req.user.role === "ADMIN") {
    if (user_id) where.user_id = Number(user_id);
  } else {
    where.user_id = req.user.id;
  }
  if (categorie) where.categorie = categorie; // code de catégorie (dynamique)
  if (statut && STATUTS.includes(statut)) where.statut = statut;
  if (priorite && PRIORITES.includes(priorite)) where.priorite = priorite;
  if (date_debut || date_fin) {
    where.date_activite = {};
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
  const { user_id, ...donnees } = v.data;

  // La catégorie doit correspondre à une catégorie active.
  if (!(await categorieActiveExiste(donnees.categorie))) {
    return res.status(400).json({ detail: "Catégorie inconnue ou désactivée." });
  }

  // Le statut « À faire » est réservé à l'administrateur (affectation de tâche).
  if (req.user.role !== "ADMIN" && donnees.statut === "A_FAIRE") {
    return res.status(400).json({
      detail: "Le statut « À faire » est réservé à l'affectation par un administrateur.",
    });
  }

  let cibleId = req.user.id;
  let destinataire = null;
  if (user_id && user_id !== req.user.id) {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ detail: "Vous ne pouvez créer que vos propres activités." });
    }
    destinataire = await User.findByPk(user_id);
    if (!destinataire) {
      return res.status(404).json({ detail: "Employé cible introuvable." });
    }
    cibleId = user_id;
  }

  const activite = await Activite.create({
    ...donnees,
    user_id: cibleId,
    // Marque l'affectation par un admin (l'employé ne pourra changer que le statut).
    assignee_par_admin: Boolean(destinataire),
  });
  const complet = await Activite.findByPk(activite.id, { include: { model: User, as: "user" } });

  if (destinataire) {
    // Affectation par l'admin à un employé -> notification plateforme + e-mail.
    await sansErreur(
      notifierAffectation({ destinataire, admin: req.user, activite: complet }),
      "affectation",
    );
  } else if (req.user.role !== "ADMIN") {
    // Un employé a créé sa propre activité -> alerte des administrateurs.
    await sansErreur(
      notifierNouvelleTacheEmploye({ auteur: req.user, activite: complet }),
      "nouvelle tâche employé",
    );
  }

  res.status(201).json(serialiserActivite(complet));
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

  // Tâche affectée par l'admin : un employé ne peut en modifier QUE le statut.
  let donnees = v.data;
  if (req.user.role !== "ADMIN" && activite.assignee_par_admin) {
    donnees = v.data.statut !== undefined ? { statut: v.data.statut } : {};
  }

  // Validation de la catégorie si elle est modifiée.
  if (donnees.categorie && !(await categorieActiveExiste(donnees.categorie))) {
    return res.status(400).json({ detail: "Catégorie inconnue ou désactivée." });
  }

  const ancienStatut = activite.statut;
  const proprietaire = activite.user; // inclus par chargerOu404
  await activite.update(donnees);
  const complet = await Activite.findByPk(activite.id, { include: { model: User, as: "user" } });

  const statutChange = donnees.statut && donnees.statut !== ancienStatut;
  if (req.user.role !== "ADMIN" && statutChange) {
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
  } else if (req.user.role === "ADMIN" && proprietaire && proprietaire.id !== req.user.id) {
    // L'admin a modifié la tâche d'un employé -> notification interne à l'employé.
    await sansErreur(
      notifierModificationTache({ destinataire: proprietaire, admin: req.user, activite: complet }),
      "modification tâche",
    );
  }

  res.json(serialiserActivite(complet));
});

// DELETE /activites/:id
activitesRouter.delete("/:id", async (req, res) => {
  const activite = await chargerOu404(Number(req.params.id), req.user, res);
  if (!activite) return;
  const proprietaire = activite.user;
  const snapshot = { titre: activite.titre };
  await activite.destroy();

  // L'admin a supprimé la tâche d'un employé -> notification interne à l'employé.
  if (req.user.role === "ADMIN" && proprietaire && proprietaire.id !== req.user.id) {
    await sansErreur(
      notifierSuppressionTache({ destinataire: proprietaire, admin: req.user, activite: snapshot }),
      "suppression tâche",
    );
  }
  res.status(204).end();
});
