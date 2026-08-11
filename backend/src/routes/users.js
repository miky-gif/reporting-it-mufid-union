// Gestion des utilisateurs — hiérarchie à 3 niveaux.
//   SUPER_ADMIN : crée les ADMIN (rattachés à un département + droits) et les IT.
//   ADMIN       : gère uniquement les IT de SON département, s'il en a le droit.
//   EMPLOYE     : aucun accès.
import { Router } from "express";
import { fn, col, Op } from "sequelize";
import { Activite, Departement, PERMISSIONS_DEFAUT, User } from "../models/index.js";
import {
  accedeDepartement,
  departementsGeres,
  estSuperAdmin,
  estSuperviseur,
  perimetreDepartement,
  requireAdmin,
  requireAuth,
  requirePermission,
} from "../middleware/auth.js";
import { hacherMotDePasse } from "../security.js";
import { parsePermissions, serialiserUser } from "../utils.js";
import { userCreateSchema, userUpdateSchema, valider } from "../validators.js";
import { notifierBienvenue, notifierDesactivationCompte } from "../services/notifications.js";

// Enveloppe les notifications : elles ne doivent jamais faire échouer la requête.
async function sansErreur(promesse, contexte) {
  try {
    await promesse;
  } catch (e) {
    console.error(`✖ Notification (${contexte}) non envoyée :`, e.message);
  }
}

export const usersRouter = Router();
usersRouter.use(requireAuth, requireAdmin);

/** Périmètre de visibilité : le super admin voit tout, sinon ses départements. */
function perimetre(demandeur) {
  if (estSuperAdmin(demandeur)) return {};
  return { departement_id: perimetreDepartement(demandeur) }; // clause IN
}

/** Charge un utilisateur en vérifiant que le demandeur a le droit de le voir. */
async function chargerOu404(id, demandeur, res) {
  const user = await User.findByPk(id, { include: { model: Departement, as: "departement" } });
  if (!user) {
    res.status(404).json({ detail: "Utilisateur introuvable." });
    return null;
  }
  // Un admin/superviseur ne touche qu'aux agents de son périmètre. Il ne peut
  // jamais gérer un super admin ni un superviseur (comptes réservés au super admin).
  if (!estSuperAdmin(demandeur)) {
    const reserve = user.role === "SUPER_ADMIN" || user.role === "SUPERVISEUR";
    if (reserve || !accedeDepartement(demandeur, user.departement_id)) {
      res.status(403).json({ detail: "Cet utilisateur n'appartient pas à votre périmètre." });
      return null;
    }
  }
  return user;
}

/**
 * Valide et normalise le périmètre d'un SUPERVISEUR (départements gérés).
 * Renvoie { ok, ids } ; en cas d'erreur, répond et renvoie ok:false.
 */
async function validerDepartementsGeres(liste, res) {
  const ids = [...new Set((liste || []).map(Number).filter((n) => n > 0))];
  if (ids.length === 0) {
    res.status(400).json({ detail: "Sélectionnez au moins un département à superviser." });
    return { ok: false };
  }
  const trouves = await Departement.count({ where: { id: ids, actif: true } });
  if (trouves !== ids.length) {
    res.status(404).json({ detail: "Un des départements sélectionnés est introuvable ou désactivé." });
    return { ok: false };
  }
  return { ok: true, ids };
}

// GET /users — cloisonné par département (sauf super admin)
usersRouter.get("/", async (req, res) => {
  const where = perimetre(req.user);
  if (!estSuperAdmin(req.user)) where.role = { [Op.ne]: "SUPER_ADMIN" }; // un admin ne voit pas les super admins

  const users = await User.findAll({
    where,
    include: { model: Departement, as: "departement" },
    order: [["date_creation", "ASC"]],
  });
  const comptes = await Activite.findAll({
    attributes: ["user_id", [fn("COUNT", col("id")), "n"]],
    group: ["user_id"],
    raw: true,
  });
  const parUser = Object.fromEntries(comptes.map((c) => [c.user_id, Number(c.n)]));
  res.json(users.map((u) => ({ ...serialiserUser(u), nb_activites: parUser[u.id] || 0 })));
});

// POST /users — création d'un IT (admin autorisé) ou d'un ADMIN (super admin)
usersRouter.post("/", requirePermission("IT_CREER"), async (req, res) => {
  const v = valider(userCreateSchema, req.body, res);
  if (!v.ok) return;
  const { role, departement_id, departements_geres, permissions, ...champs } = v.data;

  // Seul le super admin peut créer un ADMIN, un SUPERVISEUR ou un super admin.
  if (role !== "EMPLOYE" && !estSuperAdmin(req.user)) {
    return res.status(403).json({ detail: "Seul le super administrateur peut créer un administrateur ou un superviseur." });
  }
  if (await User.findOne({ where: { email: champs.email } })) {
    return res.status(409).json({ detail: "Un utilisateur avec cet e-mail existe déjà." });
  }

  // Périmètre du superviseur : plusieurs départements gérés (le principal = le premier).
  let depsGeres = null;
  if (role === "SUPERVISEUR") {
    const dg = await validerDepartementsGeres(departements_geres, res);
    if (!dg.ok) return;
    depsGeres = dg.ids;
  }

  // Rattachement : le super admin choisit ; un admin/superviseur crée dans son périmètre.
  let depId;
  if (estSuperAdmin(req.user)) {
    depId = role === "SUPERVISEUR" ? depsGeres[0] : departement_id ?? null;
  } else {
    // Admin ou superviseur créant un IT : département dans son périmètre.
    depId = departement_id ?? req.user.departement_id ?? null;
    if (!accedeDepartement(req.user, depId)) {
      return res.status(403).json({ detail: "Ce département n'appartient pas à votre périmètre." });
    }
  }
  if (role === "SUPER_ADMIN") depId = null; // le super admin n'appartient à aucun département
  if (role !== "SUPER_ADMIN") {
    if (!depId) return res.status(400).json({ detail: "Le département est requis." });
    const dep = await Departement.findOne({ where: { id: depId, actif: true } });
    if (!dep) return res.status(404).json({ detail: "Département introuvable ou désactivé." });
  }

  const avecDroits = role === "ADMIN" || role === "SUPERVISEUR";
  const user = await User.create({
    nom_complet: champs.nom_complet,
    email: champs.email,
    poste: champs.poste ?? null,
    role,
    actif: champs.actif,
    departement_id: depId,
    departements_geres: depsGeres, // uniquement pour un SUPERVISEUR
    // Droits granulaires : ADMIN et SUPERVISEUR (valeurs par défaut si non précisés).
    permissions: avecDroits ? permissions ?? PERMISSIONS_DEFAUT : null,
    mot_de_passe: await hacherMotDePasse(champs.mot_de_passe),
  });

  if (user.actif) {
    await sansErreur(
      notifierBienvenue({ user, motDePasse: champs.mot_de_passe, admin: req.user }),
      "bienvenue",
    );
  }
  const complet = await User.findByPk(user.id, { include: { model: Departement, as: "departement" } });
  res.status(201).json(serialiserUser(complet));
});

// GET /users/:id
usersRouter.get("/:id", async (req, res) => {
  const user = await chargerOu404(Number(req.params.id), req.user, res);
  if (!user) return;
  res.json(serialiserUser(user));
});

// PUT /users/:id
usersRouter.put("/:id", requirePermission("IT_MODIFIER"), async (req, res) => {
  const user = await chargerOu404(Number(req.params.id), req.user, res);
  if (!user) return;
  const v = valider(userUpdateSchema, req.body, res);
  if (!v.ok) return;

  const donnees = { ...v.data };

  // Empêche un administrateur de se désactiver lui-même (verrouillage du compte).
  if (user.id === req.user.id && donnees.actif === false) {
    return res.status(400).json({ detail: "Vous ne pouvez pas désactiver votre propre compte." });
  }

  // 🔒 On ne modifie JAMAIS son propre rôle ni son propre département : sans cela,
  // le super admin pourrait se rétrograder et la plateforme n'aurait plus aucun
  // super administrateur (situation irréversible depuis l'interface).
  if (user.id === req.user.id) {
    if (donnees.role && donnees.role !== user.role) {
      return res.status(400).json({
        detail: "Vous ne pouvez pas modifier votre propre rôle. Demandez à un autre super administrateur.",
      });
    }
    delete donnees.role;
    delete donnees.departement_id;
    delete donnees.departements_geres;
    delete donnees.permissions;
  }

  // 🔒 Le dernier super administrateur actif ne peut pas être rétrogradé.
  if (user.role === "SUPER_ADMIN" && donnees.role && donnees.role !== "SUPER_ADMIN") {
    const autres = await User.count({
      where: { role: "SUPER_ADMIN", actif: true, id: { [Op.ne]: user.id } },
    });
    if (autres === 0) {
      return res.status(400).json({
        detail: "Impossible de rétrograder le dernier super administrateur : la plateforme n'en aurait plus aucun.",
      });
    }
  }

  // Seul le super admin touche au rôle, au département, au périmètre et aux droits.
  if (!estSuperAdmin(req.user)) {
    delete donnees.role;
    delete donnees.departement_id;
    delete donnees.departements_geres;
    delete donnees.permissions;
  } else {
    // Rôle effectif après mise à jour (celui envoyé, ou l'actuel s'il est inchangé).
    const roleEffectif = donnees.role ?? user.role;

    if (roleEffectif === "SUPERVISEUR") {
      // Le périmètre est requis : soit fourni maintenant, soit déjà enregistré.
      const liste = donnees.departements_geres ?? departementsGeres(user);
      const dg = await validerDepartementsGeres(liste, res);
      if (!dg.ok) return;
      donnees.departements_geres = dg.ids;
      donnees.departement_id = dg.ids[0]; // département principal = le premier géré
      // Conserve les droits existants (ou valeurs par défaut) si non précisés.
      if (donnees.permissions === undefined && !parsePermissions(user.permissions).length) {
        donnees.permissions = PERMISSIONS_DEFAUT;
      }
    } else {
      // Tout autre rôle n'a pas de périmètre multi-départements.
      donnees.departements_geres = null;
      if (roleEffectif !== "ADMIN") {
        donnees.permissions = null; // les droits ne concernent qu'ADMIN et SUPERVISEUR
        // Un super administrateur n'appartient à aucun département : il les voit tous.
        if (roleEffectif === "SUPER_ADMIN") donnees.departement_id = null;
      }
    }
  }
  if (donnees.email && donnees.email !== user.email) {
    if (await User.findOne({ where: { email: donnees.email } })) {
      return res.status(409).json({ detail: "Cet e-mail est déjà utilisé." });
    }
  }
  if (donnees.mot_de_passe) {
    donnees.mot_de_passe = await hacherMotDePasse(donnees.mot_de_passe);
  } else {
    delete donnees.mot_de_passe;
  }

  await user.update(donnees);
  // Si l'agent change de département, ses activités le suivent.
  if (donnees.departement_id) {
    await Activite.update({ departement_id: donnees.departement_id }, { where: { user_id: user.id } });
  }
  const complet = await User.findByPk(user.id, { include: { model: Departement, as: "departement" } });
  res.json(serialiserUser(complet));
});

// DELETE /users/:id — désactivation logique (soft delete)
usersRouter.delete("/:id", requirePermission("IT_DESACTIVER"), async (req, res) => {
  const user = await chargerOu404(Number(req.params.id), req.user, res);
  if (!user) return;
  if (user.id === req.user.id) {
    return res.status(400).json({ detail: "Vous ne pouvez pas désactiver votre propre compte." });
  }
  if (user.role === "SUPER_ADMIN") {
    const autres = await User.count({
      where: { role: "SUPER_ADMIN", actif: true, id: { [Op.ne]: user.id } },
    });
    if (autres === 0) {
      return res.status(400).json({ detail: "Impossible de désactiver le dernier super administrateur." });
    }
  }
  await user.update({ actif: false });
  await sansErreur(notifierDesactivationCompte({ user }), "désactivation");
  res.json(serialiserUser(user));
});
