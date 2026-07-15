// Planificateur des tâches récurrentes.
// Une tâche « modèle » (recurrence != AUCUNE) régénère automatiquement de
// nouvelles occurrences à chaque échéance. Chaque occurrence déclenche une
// notification (plateforme + e-mail). Le planificateur RATTRAPE les occurrences
// manquées si le serveur a été arrêté plusieurs jours.
import { Op } from "sequelize";
import { Activite, User } from "../models/index.js";
import { ajouterIntervalle } from "../utils.js";
import { notifierOccurrenceRecurrente } from "./notifications.js";

// Sécurités : on ne génère jamais une avalanche d'occurrences en un seul passage.
const MAX_PAR_MODELE = 60; // rattrapage borné par tâche
const INTERVALLE_MS = 60 * 60 * 1000; // vérification toutes les heures

const aujourdhuiISO = () => new Date().toISOString().slice(0, 10);
const joursEntre = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Notifications non bloquantes (une occurrence doit être créée même si le mail échoue).
async function sansErreur(promesse, ctx) {
  try {
    await promesse;
  } catch (e) {
    console.error(`✖ Récurrence (${ctx}) :`, e.message);
  }
}

// Crée une occurrence à partir d'un modèle, pour la date de début donnée.
async function creerOccurrence(modele, dateDebut) {
  // On conserve la durée de la période initiale (fin - début).
  const span =
    modele.date_debut && modele.date_fin ? Math.max(0, joursEntre(modele.date_debut, modele.date_fin)) : 0;
  const dateFin = ajouterIntervalle(dateDebut, "JOUR", span);

  const occ = await Activite.create({
    user_id: modele.user_id,
    departement_id: modele.departement_id,
    titre: modele.titre,
    consignes: modele.consignes,
    livrable: modele.livrable, // résultat attendu conservé
    description: null, // état d'exécution : repart vide
    activites_a_mener: null,
    categorie: modele.categorie,
    priorite: modele.priorite,
    statut: "A_FAIRE",
    pourcentage: 0,
    date_debut: dateDebut,
    date_fin: dateFin,
    date_activite: dateFin,
    duree_minutes: modele.duree_minutes,
    duree_heures: modele.duree_heures,
    assignee_par_admin: modele.assignee_par_admin,
    // L'occurrence ne se régénère pas elle-même : seul le modèle génère.
    recurrence: "AUCUNE",
    recurrence_parent_id: modele.id,
  });

  const destinataire = modele.user ?? (await User.findByPk(modele.user_id));
  if (destinataire && destinataire.actif) {
    await sansErreur(
      notifierOccurrenceRecurrente({ destinataire, activite: occ, frequence: modele.recurrence }),
      "notification",
    );
  }
  return occ;
}

/**
 * Génère toutes les occurrences dues (jusqu'à aujourd'hui inclus) puis avance
 * le compteur de chaque modèle. Renvoie le nombre d'occurrences créées.
 */
export async function genererOccurrencesDues() {
  const auj = aujourdhuiISO();
  const modeles = await Activite.findAll({
    where: {
      recurrence: { [Op.ne]: "AUCUNE" },
      recurrence_active: true,
      recurrence_prochaine: { [Op.ne]: null, [Op.lte]: auj },
    },
    include: { model: User, as: "user" },
  });

  let creees = 0;
  for (const modele of modeles) {
    // On ne génère pas pour un agent désactivé (mais on continue d'avancer le compteur).
    let prochaine = modele.recurrence_prochaine;
    let n = 0;
    let terminee = false;

    while (prochaine <= auj && n < MAX_PAR_MODELE) {
      if (modele.recurrence_fin && prochaine > modele.recurrence_fin) {
        terminee = true;
        break;
      }
      if (modele.user?.actif !== false) {
        await creerOccurrence(modele, prochaine);
        creees += 1;
      }
      prochaine = ajouterIntervalle(prochaine, modele.recurrence, 1);
      n += 1;
    }

    if (modele.recurrence_fin && prochaine > modele.recurrence_fin) terminee = true;
    await modele.update({
      recurrence_prochaine: prochaine,
      recurrence_active: terminee ? false : modele.recurrence_active,
    });
  }
  return creees;
}

let timer = null;

/** Démarre le planificateur : une exécution immédiate puis toutes les heures. */
export function demarrerPlanificateur() {
  const tourner = async () => {
    try {
      const n = await genererOccurrencesDues();
      if (n > 0) console.log(`↻ Récurrence : ${n} occurrence(s) générée(s).`);
    } catch (e) {
      console.error("✖ Planificateur de récurrence :", e.message);
    }
  };
  tourner(); // rattrapage au démarrage
  timer = setInterval(tourner, INTERVALLE_MS);
  if (timer.unref) timer.unref();
  console.log("✔ Planificateur de tâches récurrentes actif (vérification horaire).");
}
