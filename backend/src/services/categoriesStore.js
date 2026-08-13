// Accès aux catégories : chargement de la table, map code -> {nom, couleur},
// et provisionnement des catégories par défaut si la table est vide.
import { Categorie } from "../models/index.js";
import { CATEGORIES_DEFAUT } from "../data/categoriesDefaut.js";
import { dossierDepuisLibelle, normaliserDossier } from "./uploads.js";

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

/** Parse une colonne JSON objet (MariaDB peut la renvoyer en chaîne). */
export function parseMap(valeur) {
  if (!valeur) return {};
  if (typeof valeur === "object" && !Array.isArray(valeur)) return valeur;
  try {
    const p = JSON.parse(valeur);
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

/**
 * Dossier de rangement des pièces jointes pour une rubrique donnée.
 * Priorité : dossier configuré par l'administrateur sur la catégorie ;
 * à défaut, « Catégorie/Rubrique » déduit des libellés (jamais la racine,
 * pour éviter le fourre-tout d'un dossier unique).
 */
export async function dossierDeRubrique(codeCategorie, rubrique) {
  const cat = await Categorie.findOne({ where: { code: codeCategorie } });
  if (!cat) return dossierDepuisLibelle(rubrique || "Divers");

  const configures = parseMap(cat.dossiers_rubriques);
  const choisi = normaliserDossier(configures[rubrique]);
  if (choisi) return choisi;

  // Repli lisible : un dossier par catégorie, puis par rubrique.
  const base = dossierDepuisLibelle(cat.nom);
  const feuille = dossierDepuisLibelle(rubrique);
  return feuille && feuille !== base ? `${base}/${feuille}` : base;
}
