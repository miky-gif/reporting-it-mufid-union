// Gestion des départements — réservée au SUPER ADMINISTRATEUR.
// Chaque département a ses agents, ses catégories, et peut avoir sa propre
// boîte d'envoi SMTP (les mails de ses agents partent alors de cette boîte).
import { Router } from "express";
import { Activite, Categorie, Departement, User } from "../models/index.js";
import { requireAuth, requireSuperAdmin, estSuperAdmin } from "../middleware/auth.js";
import { invaliderTransport, verifierSmtpDepartement } from "../services/mailer.js";
import { serialiserDepartement, slugAscii } from "../utils.js";
import { departementCreateSchema, departementUpdateSchema, smtpSchema, valider } from "../validators.js";

export const departementsRouter = Router();
departementsRouter.use(requireAuth);

// Génère un code unique à partir du nom (ex. « Exploitation Système » -> EXPLOITATION_SYSTEME).
async function codeUnique(nom) {
  const base = slugAscii(nom).toUpperCase().slice(0, 34) || "DEPARTEMENT";
  let code = base;
  let i = 2;
  while (await Departement.findOne({ where: { code } })) code = `${base}_${i++}`;
  return code;
}

// GET /departements — la liste. Un admin/IT ne voit que le sien.
departementsRouter.get("/", async (req, res) => {
  const where = estSuperAdmin(req.user)
    ? {}
    : { id: req.user.departement_id ?? -1 };
  const deps = await Departement.findAll({ where, order: [["nom", "ASC"]] });

  // Le super admin voit aussi les effectifs de chaque département.
  if (!estSuperAdmin(req.user)) return res.json(deps.map(serialiserDepartement));

  const sortie = [];
  for (const d of deps) {
    sortie.push({
      ...serialiserDepartement(d),
      nb_admins: await User.count({ where: { departement_id: d.id, role: "ADMIN", actif: true } }),
      nb_agents: await User.count({ where: { departement_id: d.id, role: "EMPLOYE", actif: true } }),
      nb_activites: await Activite.count({ where: { departement_id: d.id } }),
      nb_categories: await Categorie.count({ where: { departement_id: d.id, actif: true } }),
    });
  }
  res.json(sortie);
});

// POST /departements — création (super admin)
departementsRouter.post("/", requireSuperAdmin, async (req, res) => {
  const v = valider(departementCreateSchema, req.body, res);
  if (!v.ok) return;
  if (await Departement.findOne({ where: { nom: v.data.nom } })) {
    return res.status(409).json({ detail: "Un département portant ce nom existe déjà." });
  }
  const dep = await Departement.create({
    code: await codeUnique(v.data.nom),
    nom: v.data.nom,
    description: v.data.description ?? null,
    couleur: v.data.couleur,
    actif: true,
  });
  res.status(201).json(serialiserDepartement(dep));
});

// PUT /departements/:id — modification (super admin)
departementsRouter.put("/:id", requireSuperAdmin, async (req, res) => {
  const dep = await Departement.findByPk(Number(req.params.id));
  if (!dep) return res.status(404).json({ detail: "Département introuvable." });
  const v = valider(departementUpdateSchema, req.body, res);
  if (!v.ok) return;
  await dep.update(v.data);
  res.json(serialiserDepartement(dep));
});

// DELETE /departements/:id — désactivation logique (super admin)
departementsRouter.delete("/:id", requireSuperAdmin, async (req, res) => {
  const dep = await Departement.findByPk(Number(req.params.id));
  if (!dep) return res.status(404).json({ detail: "Département introuvable." });

  const membres = await User.count({ where: { departement_id: dep.id, actif: true } });
  if (membres > 0) {
    return res.status(400).json({
      detail: `Ce département compte encore ${membres} membre(s) actif(s). Réaffectez-les avant de le supprimer.`,
    });
  }
  await dep.update({ actif: false });
  res.json(serialiserDepartement(dep));
});

/* ------------------------------------------------------------------ */
/* Boîte d'envoi SMTP du département                                   */
/* ------------------------------------------------------------------ */

// PUT /departements/:id/smtp — configure la boîte d'envoi (super admin)
departementsRouter.put("/:id/smtp", requireSuperAdmin, async (req, res) => {
  const dep = await Departement.findByPk(Number(req.params.id));
  if (!dep) return res.status(404).json({ detail: "Département introuvable." });
  const v = valider(smtpSchema, req.body, res);
  if (!v.ok) return;

  const donnees = { ...v.data };
  // Mot de passe vide = on conserve celui déjà enregistré.
  if (!donnees.smtp_pass) delete donnees.smtp_pass;
  await dep.update(donnees);
  invaliderTransport(dep.id); // le prochain envoi reconstruira le transport
  res.json(serialiserDepartement(dep));
});

// POST /departements/:id/smtp/test — vérifie la connexion au serveur (super admin)
departementsRouter.post("/:id/smtp/test", requireSuperAdmin, async (req, res) => {
  const dep = await Departement.findByPk(Number(req.params.id));
  if (!dep) return res.status(404).json({ detail: "Département introuvable." });
  const r = await verifierSmtpDepartement(dep);
  if (!r.ok) return res.status(400).json({ detail: `Connexion SMTP impossible : ${r.raison}` });
  res.json({ detail: "Connexion au serveur SMTP réussie. La boîte d'envoi est opérationnelle." });
});
