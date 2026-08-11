// Libellé d'en-tête de département pour les rapports et statistiques.
// Gère un périmètre à géométrie variable :
//   - null                -> tous les départements (super admin) ;
//   - un identifiant       -> un seul département (admin) ;
//   - un tableau d'ids     -> plusieurs départements (superviseur).
import { Departement } from "../models/index.js";
import { libelleDepartement } from "../utils.js";

export const DEPARTEMENT_DEFAUT = "Direction des Systèmes d'Information";

/** Construit le libellé d'en-tête à partir d'une liste de départements. */
function libelleListe(deps) {
  if (deps.length === 0) return DEPARTEMENT_DEFAUT;
  if (deps.length === 1) return libelleDepartement(deps[0].nom);
  return `Départements — ${deps.map((d) => d.nom).join(", ")}`;
}

/**
 * Libellé d'en-tête pour un périmètre de département (null | id | [ids]).
 */
export async function libelleEnteteDepartement(scope) {
  if (scope == null) {
    const deps = await Departement.findAll({ where: { actif: true }, order: [["nom", "ASC"]] });
    if (deps.length === 1) return libelleDepartement(deps[0].nom);
    if (deps.length > 1) return `Tous les départements — ${deps.map((d) => d.nom).join(", ")}`;
    return DEPARTEMENT_DEFAUT;
  }
  const ids = (Array.isArray(scope) ? scope : [scope]).map(Number).filter((n) => n > 0);
  if (ids.length === 0) return DEPARTEMENT_DEFAUT;
  const deps = await Departement.findAll({ where: { id: ids }, order: [["nom", "ASC"]] });
  return libelleListe(deps);
}
