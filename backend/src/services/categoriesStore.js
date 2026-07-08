// Accès aux catégories : chargement de la table, map code -> {nom, couleur},
// et provisionnement des catégories par défaut si la table est vide.
import { Categorie } from "../models/index.js";
import { CATEGORIES_DEFAUT } from "../data/categoriesDefaut.js";

/** Insère les catégories par défaut si aucune n'existe encore. */
export async function assurerCategoriesParDefaut() {
  const total = await Categorie.count();
  if (total > 0) return;
  await Categorie.bulkCreate(
    CATEGORIES_DEFAUT.map((c) => ({
      code: c.code,
      nom: c.nom,
      couleur: c.couleur,
      rubriques: c.rubriques,
      ordre: c.ordre,
      actif: true,
    })),
  );
}

/** Retourne une map { code: { nom, couleur } } de toutes les catégories. */
export async function chargerMapCategories() {
  const cats = await Categorie.findAll({ raw: true });
  const map = {};
  for (const c of cats) map[c.code] = { nom: c.nom, couleur: c.couleur };
  return map;
}

/** Vrai si le code correspond à une catégorie active. */
export async function categorieActiveExiste(code) {
  const c = await Categorie.findOne({ where: { code, actif: true } });
  return Boolean(c);
}
