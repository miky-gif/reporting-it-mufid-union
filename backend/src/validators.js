// Schémas de validation zod (entrées API) + helper de validation.
import { z } from "zod";
import { CODES_PERMISSIONS, PRIORITES, RECURRENCES, ROLES, STATUTS } from "./models/index.js";

const email = z.string().email("Adresse e-mail invalide.");

export const loginSchema = z.object({
  email,
  mot_de_passe: z.string().min(1, "Mot de passe requis."),
});

export const changeMotDePasseSchema = z.object({
  ancien_mot_de_passe: z.string().min(1, "Mot de passe actuel requis."),
  nouveau_mot_de_passe: z.string().min(6, "6 caractères minimum."),
});

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const activiteBase = z.object({
  titre: z.string().min(2, "Le titre est requis (2 caractères min.).").max(200),
  description: z.string().max(2000).optional().nullable(), // état d'exécution de l'activité
  consignes: z.string().max(2000).optional().nullable(), // consigne de départ (admin)
  livrable: z.string().max(1000).optional().nullable(),
  activites_a_mener: z.string().max(1000).optional().nullable(),
  categorie: z.string().min(1, "Catégorie requise.").max(40), // code de catégorie (validé côté route)
  priorite: z.enum(PRIORITES).default("MOYENNE"),
  statut: z.enum(STATUTS).default("A_FAIRE"),
  // % de réalisation (0-100). Si absent, déduit du statut.
  pourcentage: z.coerce.number().int().min(0).max(100).optional().nullable(),
  // Ajustement manuel des points par l'admin (bonus/malus). -100 à +100.
  points_ajustement: z.coerce.number().min(-100).max(100).optional(),
  // Période de réalisation (début -> fin). L'échéance = date_fin (calculée côté route).
  date_debut: z.string().regex(dateRe, "Date de début invalide (AAAA-MM-JJ)."),
  date_fin: z.string().regex(dateRe, "Date de fin invalide (AAAA-MM-JJ)."),
  // Durée libre en minutes (granularité fine). 1 min à 24 h (1440 min).
  duree_minutes: z.coerce.number().int().min(1, "Durée requise (en minutes).").max(1440),
  // Récurrence : régénère automatiquement de nouvelles occurrences.
  recurrence: z.enum(RECURRENCES).default("AUCUNE"),
  recurrence_fin: z.string().regex(dateRe, "Date de fin de récurrence invalide.").optional().nullable(),
  user_id: z.coerce.number().int().positive().optional(),
  // Affectation multiple : liste d'agents destinataires (admin).
  user_ids: z.array(z.coerce.number().int().positive()).optional(),
});

const periodeCoherente = (d) =>
  !d.date_debut || !d.date_fin || d.date_fin >= d.date_debut;
const messagePeriode = { message: "La date de fin doit être postérieure ou égale à la date de début.", path: ["date_fin"] };

export const activiteCreateSchema = activiteBase.refine(periodeCoherente, messagePeriode);

export const activiteUpdateSchema = activiteBase
  .partial()
  .omit({ user_id: true, user_ids: true })
  .refine(periodeCoherente, messagePeriode);

// Réaffectation d'une tâche à un autre agent (admin).
// La période et la durée peuvent être redéfinies : sans quoi une tâche déjà
// en retard chez l'agent précédent resterait en retard chez le nouveau.
export const reaffecterSchema = z
  .object({
    user_id: z.coerce.number().int().positive("Sélectionnez l'agent destinataire."),
    motif: z.string().max(500).optional().nullable(),
    // Repartir de zéro : statut « À faire » et 0 % pour le nouvel agent.
    reinitialiser: z.coerce.boolean().default(true),
    // Nouvelle période / durée (facultatives : si absentes, on garde l'existant).
    date_debut: z.string().regex(dateRe, "Date de début invalide (AAAA-MM-JJ).").optional(),
    date_fin: z.string().regex(dateRe, "Date de fin invalide (AAAA-MM-JJ).").optional(),
    duree_minutes: z.coerce.number().int().min(1).max(1440).optional(),
  })
  .refine(periodeCoherente, messagePeriode);

/* ---- Départements (super admin) ------------------------------------ */
const couleurHexDep = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Couleur hexadécimale invalide (ex. #0E5E7C).");

export const departementCreateSchema = z.object({
  nom: z.string().min(2, "Nom du département requis.").max(120),
  description: z.string().max(255).optional().nullable(),
  couleur: couleurHexDep.default("#0E5E7C"),
});

export const departementUpdateSchema = z.object({
  nom: z.string().min(2).max(120).optional(),
  description: z.string().max(255).optional().nullable(),
  couleur: couleurHexDep.optional(),
  actif: z.boolean().optional(),
});

// Boîte d'envoi SMTP propre au département (mot de passe vide = inchangé).
export const smtpSchema = z.object({
  smtp_host: z.string().max(150).optional().nullable(),
  smtp_port: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtp_user: z.string().max(150).optional().nullable(),
  smtp_pass: z.string().max(255).optional().nullable(),
  smtp_tls_insecure: z.coerce.boolean().default(false),
  mail_from: z.string().max(200).optional().nullable(),
});

export const userCreateSchema = z.object({
  nom_complet: z.string().min(2, "Nom requis.").max(150),
  email,
  poste: z.string().max(120).optional().nullable(),
  role: z.enum(ROLES).default("EMPLOYE"),
  actif: z.boolean().default(true),
  mot_de_passe: z.string().min(6, "6 caractères minimum."),
  // Rattachement + droits (contrôlés côté route selon le rôle du demandeur).
  departement_id: z.coerce.number().int().positive().optional().nullable(),
  permissions: z.array(z.enum(CODES_PERMISSIONS)).optional(),
});

export const userUpdateSchema = z.object({
  nom_complet: z.string().min(2).max(150).optional(),
  email: email.optional(),
  poste: z.string().max(120).optional().nullable(),
  role: z.enum(ROLES).optional(),
  actif: z.boolean().optional(),
  mot_de_passe: z.string().min(6).optional(),
  departement_id: z.coerce.number().int().positive().optional().nullable(),
  permissions: z.array(z.enum(CODES_PERMISSIONS)).optional(),
});

const couleurHex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Couleur hexadécimale invalide (ex. #0E5E7C).");

export const categorieCreateSchema = z.object({
  nom: z.string().min(2, "Nom de catégorie requis.").max(80),
  couleur: couleurHex.default("#64757D"),
  rubriques: z.array(z.string().min(1).max(120)).default([]),
  // Département cible (le super admin peut le choisir ; un admin crée dans le sien).
  departement_id: z.coerce.number().int().positive().optional().nullable(),
});

export const categorieUpdateSchema = z.object({
  nom: z.string().min(2).max(80).optional(),
  couleur: couleurHex.optional(),
  rubriques: z.array(z.string().min(1).max(120)).optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().optional(),
  departement_id: z.coerce.number().int().positive().optional().nullable(),
});

// Valide `data` contre `schema` ; renvoie { ok, data } ou envoie une 422.
export function valider(schema, data, res) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const premier = r.error.issues[0];
    res.status(422).json({ detail: premier?.message || "Données invalides." });
    return { ok: false };
  }
  return { ok: true, data: r.data };
}
