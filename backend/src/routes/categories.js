// Routes de gestion des catégories (et de leurs rubriques).
// Les catégories appartiennent à UN département : chaque département a son
// propre référentiel métier. Un admin ne gère que celles de son département.
import { Router } from "express";
import { Activite, Categorie } from "../models/index.js";
import { estSuperAdmin, requireAuth, requirePermission } from "../middleware/auth.js";
import { categorieCreateSchema, categorieUpdateSchema, valider } from "../validators.js";
import { slugAscii } from "../utils.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

// MariaDB renvoie les colonnes JSON sous forme de chaîne : on parse si besoin.
function parseRubriques(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function serialiser(c) {
  const p = c.get ? c.get({ plain: true }) : c;
  return {
    id: p.id,
    code: p.code,
    nom: p.nom,
    couleur: p.couleur,
    rubriques: parseRubriques(p.rubriques),
    ordre: p.ordre,
    actif: !!p.actif,
    departement_id: p.departement_id ?? null,
  };
}

// Génère un code unique (SLUG en majuscules) à partir du nom.
async function genererCode(nom) {
  const base = slugAscii(nom).toUpperCase().slice(0, 36) || "CATEGORIE";
  let code = base;
  let i = 1;
  while (await Categorie.findOne({ where: { code } })) code = `${base}_${i++}`;
  return code;
}

/** Charge une catégorie du périmètre du demandeur, ou répond 404/403. */
async function chargerOu404(id, demandeur, res) {
  const cat = await Categorie.findByPk(id);
  if (!cat) {
    res.status(404).json({ detail: "Catégorie introuvable." });
    return null;
  }
  if (!estSuperAdmin(demandeur) && cat.departement_id !== demandeur.departement_id) {
    res.status(403).json({ detail: "Cette catégorie appartient à un autre département." });
    return null;
  }
  return cat;
}

// GET /categories — celles du département de l'utilisateur (toutes pour le super admin).
categoriesRouter.get("/", async (req, res) => {
  const where = estSuperAdmin(req.user) ? {} : { departement_id: req.user.departement_id ?? -1 };
  const cats = await Categorie.findAll({
    where,
    order: [["ordre", "ASC"], ["nom", "ASC"]],
  });
  res.json(cats.map(serialiser));
});

// --- À partir d'ici : droit « Gérer les catégories et rubriques » ---
categoriesRouter.use(requirePermission("CATEGORIES_GERER"));

// POST /categories — créée dans le département du demandeur.
categoriesRouter.post("/", async (req, res) => {
  const v = valider(categorieCreateSchema, req.body, res);
  if (!v.ok) return;

  // Le super admin peut viser un département précis ; l'admin crée dans le sien.
  const depId = estSuperAdmin(req.user)
    ? v.data.departement_id ?? null
    : req.user.departement_id;
  if (!depId) {
    return res.status(400).json({ detail: "Le département de la catégorie est requis." });
  }

  const code = await genererCode(v.data.nom);
  const dernier = await Categorie.max("ordre", { where: { departement_id: depId } });
  const cat = await Categorie.create({
    code,
    nom: v.data.nom,
    couleur: v.data.couleur,
    rubriques: v.data.rubriques,
    ordre: (Number.isFinite(dernier) ? dernier : 0) + 1,
    actif: true,
    departement_id: depId,
  });
  res.status(201).json(serialiser(cat));
});

// PUT /categories/:id — modifie nom, couleur, rubriques, actif, ordre (pas le code).
categoriesRouter.put("/:id", async (req, res) => {
  const cat = await chargerOu404(Number(req.params.id), req.user, res);
  if (!cat) return;
  const v = valider(categorieUpdateSchema, req.body, res);
  if (!v.ok) return;
  const donnees = { ...v.data };
  if (!estSuperAdmin(req.user)) delete donnees.departement_id; // un admin ne déplace pas une catégorie
  await cat.update(donnees);
  res.json(serialiser(cat));
});

// DELETE /categories/:id — supprime si inutilisée, sinon désactive (préserve l'historique).
categoriesRouter.delete("/:id", async (req, res) => {
  const cat = await chargerOu404(Number(req.params.id), req.user, res);
  if (!cat) return;

  const utilisations = await Activite.count({ where: { categorie: cat.code } });
  if (utilisations > 0) {
    await cat.update({ actif: false });
    return res.json({ ...serialiser(cat), desactivee: true, utilisations });
  }
  await cat.destroy();
  res.status(204).end();
});
