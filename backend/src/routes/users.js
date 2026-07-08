// Routes de gestion des utilisateurs (réservées à l'ADMIN).
import { Router } from "express";
import { Activite, User } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { hacherMotDePasse } from "../security.js";
import { serialiserUser } from "../utils.js";
import { userCreateSchema, userUpdateSchema, valider } from "../validators.js";
import { fn, col } from "sequelize";
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

// GET /users — avec le nombre d'activités par utilisateur
usersRouter.get("/", async (_req, res) => {
  const users = await User.findAll({ order: [["date_creation", "ASC"]] });
  const comptes = await Activite.findAll({
    attributes: ["user_id", [fn("COUNT", col("id")), "n"]],
    group: ["user_id"],
    raw: true,
  });
  const parUser = Object.fromEntries(comptes.map((c) => [c.user_id, Number(c.n)]));
  res.json(users.map((u) => ({ ...serialiserUser(u), nb_activites: parUser[u.id] || 0 })));
});

// POST /users
usersRouter.post("/", async (req, res) => {
  const v = valider(userCreateSchema, req.body, res);
  if (!v.ok) return;
  if (await User.findOne({ where: { email: v.data.email } })) {
    return res.status(409).json({ detail: "Un utilisateur avec cet e-mail existe déjà." });
  }
  const user = await User.create({
    nom_complet: v.data.nom_complet,
    email: v.data.email,
    poste: v.data.poste ?? null,
    role: v.data.role,
    actif: v.data.actif,
    mot_de_passe: await hacherMotDePasse(v.data.mot_de_passe),
  });

  // E-mail de bienvenue (avec le mot de passe initial défini par l'admin) + notif interne.
  if (user.actif) {
    await sansErreur(
      notifierBienvenue({ user, motDePasse: v.data.mot_de_passe, admin: req.user }),
      "bienvenue",
    );
  }

  res.status(201).json(serialiserUser(user));
});

// GET /users/:id
usersRouter.get("/:id", async (req, res) => {
  const user = await User.findByPk(Number(req.params.id));
  if (!user) return res.status(404).json({ detail: "Utilisateur introuvable." });
  res.json(serialiserUser(user));
});

// PUT /users/:id
usersRouter.put("/:id", async (req, res) => {
  const user = await User.findByPk(Number(req.params.id));
  if (!user) return res.status(404).json({ detail: "Utilisateur introuvable." });
  const v = valider(userUpdateSchema, req.body, res);
  if (!v.ok) return;

  const donnees = { ...v.data };
  // Empêche un administrateur de se désactiver lui-même (verrouillage du compte).
  if (user.id === req.user.id && donnees.actif === false) {
    return res.status(400).json({ detail: "Vous ne pouvez pas désactiver votre propre compte." });
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
  res.json(serialiserUser(user));
});

// DELETE /users/:id — désactivation logique (soft delete)
usersRouter.delete("/:id", async (req, res) => {
  const user = await User.findByPk(Number(req.params.id));
  if (!user) return res.status(404).json({ detail: "Utilisateur introuvable." });
  if (user.id === req.user.id) {
    return res.status(400).json({ detail: "Vous ne pouvez pas désactiver votre propre compte." });
  }
  await user.update({ actif: false });
  await sansErreur(notifierDesactivationCompte({ user }), "désactivation");
  res.json(serialiserUser(user));
});
