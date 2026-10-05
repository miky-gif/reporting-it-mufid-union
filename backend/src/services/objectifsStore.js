// Gestion des objectifs d'une tâche : ce qu'on attend concrètement de l'agent.
// L'administrateur définit les libellés et les cibles ; l'agent ne saisit que
// son avancement (« réalisé »). Le pourcentage de la tâche en découle.
import { Objectif } from "../models/index.js";
import { pourcentageObjectifs } from "../utils.js";

/** Objectifs d'une tâche, dans l'ordre défini par l'administrateur. */
export const listerObjectifs = (activiteId) =>
  Objectif.findAll({
    where: { activite_id: activiteId },
    order: [["ordre", "ASC"], ["id", "ASC"]],
  });

const borner = (v) => Math.max(0, Number(v) || 0);

/**
 * Normalise une entrée reçue de l'interface (un jalon a toujours une cible de 1).
 * `existant` sert de repli : une valeur absente ne doit jamais écraser l'existant.
 */
function champsDepuis(envoye, ordre, existant = null) {
  const type = envoye.type ?? existant?.type ?? "QUANTITATIF";
  const jalon = type === "JALON";
  const cibleBrute = envoye.cible !== undefined ? envoye.cible : existant?.cible;
  return {
    libelle: String(envoye.libelle ?? existant?.libelle ?? "").trim(),
    type: jalon ? "JALON" : "QUANTITATIF",
    cible: jalon ? 1 : borner(cibleBrute),
    ordre,
  };
}

/**
 * Crée les objectifs d'une tâche (création, ou nouvelle occurrence récurrente).
 * `remiseAZero` : l'avancement repart de 0 — c'est le cas d'une occurrence.
 */
export async function creerObjectifs(activiteId, liste, { remiseAZero = false } = {}) {
  const entrees = (liste || []).filter((o) => String(o?.libelle || "").trim());
  for (const [i, envoye] of entrees.entries()) {
    const champs = champsDepuis(envoye, i);
    await Objectif.create({
      ...champs,
      activite_id: activiteId,
      realise: remiseAZero ? 0 : borner(envoye.realise),
      date_maj: new Date(),
    });
  }
}

/**
 * Applique la liste envoyée par l'interface.
 *  - `complet` (administration) : liste maîtresse — ajout, modification, suppression.
 *    L'avancement déjà saisi est préservé si l'interface ne le renvoie pas.
 *  - sinon (agent) : SEUL l'avancement des objectifs existants est mis à jour.
 *    L'agent ne peut ni changer une cible, ni ajouter, ni supprimer un objectif.
 */
export async function appliquerObjectifs(activiteId, liste, { complet }) {
  if (!Array.isArray(liste)) return;
  const existants = await listerObjectifs(activiteId);
  const parId = new Map(existants.map((o) => [o.id, o]));

  if (!complet) {
    for (const envoye of liste) {
      const obj = parId.get(Number(envoye?.id));
      if (!obj) continue; // ignore silencieusement tout ajout/suppression tenté
      await obj.update({ realise: borner(envoye.realise), date_maj: new Date() });
    }
    return;
  }

  const conserves = new Set();
  for (const [i, envoye] of liste.entries()) {
    const existant = parId.get(Number(envoye?.id));
    // Le libellé peut être omis : on reprend alors celui déjà enregistré.
    const champs = champsDepuis(envoye, i, existant);
    if (!champs.libelle) continue; // ligne réellement vide : ignorée
    if (envoye.realise !== undefined) champs.realise = borner(envoye.realise);

    if (existant) {
      conserves.add(existant.id);
      await existant.update({ ...champs, date_maj: new Date() });
    } else {
      const cree = await Objectif.create({
        ...champs,
        realise: champs.realise ?? 0,
        activite_id: activiteId,
        date_maj: new Date(),
      });
      conserves.add(cree.id);
    }
  }
  // Ce que l'administrateur a retiré de la liste disparaît.
  for (const o of existants) if (!conserves.has(o.id)) await o.destroy();
}

/**
 * Recale le pourcentage de la tâche sur ses objectifs.
 * Sans objectif, ou si l'administrateur a forcé une valeur, on ne touche à rien.
 */
export async function recalculerPourcentage(activite) {
  if (activite.pourcentage_force) return;
  const objectifs = await listerObjectifs(activite.id);
  const pct = pourcentageObjectifs(objectifs);
  if (pct !== null && pct !== activite.pourcentage) {
    await activite.update({ pourcentage: pct });
  }
}
