// Routes de gestion des catégories (et de leurs rubriques).
// Lecture : tout utilisateur authentifié. Écriture : ADMIN uniquement.
import { Router } from "express";
import { Activite, Categorie } from "../models/index.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
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

// GET /categories — toutes les catégories (triées), avec leurs rubriques.
categoriesRouter.get("/", async (_req, res) => {
  const cats = await Categorie.findAll({ order: [["ordre", "ASC"], ["nom", "ASC"]] });
  res.json(cats.map(serialiser));
});

// --- À partir d'ici : ADMIN uniquement ---
categoriesRouter.use(requireAdmin);

// POST /categories
categoriesRouter.post("/", async (req, res) => {
  const v = valider(categorieCreateSchema, req.body, res);
  if (!v.ok) return;
  const code = await genererCode(v.data.nom);
  const dernier = await Categorie.max("ordre");
  const cat = await Categorie.create({
    code,
    nom: v.data.nom,
    couleur: v.data.couleur,
    rubriques: v.data.rubriques,
    ordre: (Number.isFinite(dernier) ? dernier : 0) + 1,
    actif: true,
  });
  res.status(201).json(serialiser(cat));
});

// PUT /categories/:id — modifie nom, couleur, rubriques, actif, ordre (pas le code).
categoriesRouter.put("/:id", async (req, res) => {
  const cat = await Categorie.findByPk(Number(req.params.id));
  if (!cat) return res.status(404).json({ detail: "Catégorie introuvable." });
  const v = valider(categorieUpdateSchema, req.body, res);
  if (!v.ok) return;
  await cat.update(v.data);
  res.json(serialiser(cat));
});

// DELETE /categories/:id — supprime si inutilisée, sinon désactive (préserve l'historique).
categoriesRouter.delete("/:id", async (req, res) => {
  const cat = await Categorie.findByPk(Number(req.params.id));
  if (!cat) return res.status(404).json({ detail: "Catégorie introuvable." });

  const utilisations = await Activite.count({ where: { categorie: cat.code } });
  if (utilisations > 0) {
    await cat.update({ actif: false });
    return res.json({ ...serialiser(cat), desactivee: true, utilisations });
  }
  await cat.destroy();
  res.status(204).end();
});
