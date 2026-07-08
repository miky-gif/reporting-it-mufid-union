// Schémas de validation zod (entrées API) + helper de validation.
import { z } from "zod";
import { PRIORITES, ROLES, STATUTS } from "./models/index.js";

const email = z.string().email("Adresse e-mail invalide.");

export const loginSchema = z.object({
  email,
  mot_de_passe: z.string().min(1, "Mot de passe requis."),
});

export const activiteCreateSchema = z.object({
  titre: z.string().min(2, "Le titre est requis (2 caractères min.).").max(200),
  description: z.string().max(2000).optional().nullable(), // « État d'exécution » du rapport
  livrable: z.string().max(1000).optional().nullable(),
  activites_a_mener: z.string().max(1000).optional().nullable(),
  categorie: z.string().min(1, "Catégorie requise.").max(40), // code de catégorie (validé côté route)
  priorite: z.enum(PRIORITES).default("MOYENNE"),
  statut: z.enum(STATUTS).default("A_FAIRE"),
  date_activite: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)."),
  duree_heures: z.coerce.number().min(0).max(24),
  user_id: z.coerce.number().int().positive().optional(),
});

export const activiteUpdateSchema = activiteCreateSchema.partial().omit({ user_id: true });

export const userCreateSchema = z.object({
  nom_complet: z.string().min(2, "Nom requis.").max(150),
  email,
  poste: z.string().max(120).optional().nullable(),
  role: z.enum(ROLES).default("EMPLOYE"),
  actif: z.boolean().default(true),
  mot_de_passe: z.string().min(6, "6 caractères minimum."),
});

export const userUpdateSchema = z.object({
  nom_complet: z.string().min(2).max(150).optional(),
  email: email.optional(),
  poste: z.string().max(120).optional().nullable(),
  role: z.enum(ROLES).optional(),
  actif: z.boolean().optional(),
  mot_de_passe: z.string().min(6).optional(),
});

const couleurHex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "Couleur hexadécimale invalide (ex. #0E5E7C).");

export const categorieCreateSchema = z.object({
  nom: z.string().min(2, "Nom de catégorie requis.").max(80),
  couleur: couleurHex.default("#64757D"),
  rubriques: z.array(z.string().min(1).max(120)).default([]),
});

export const categorieUpdateSchema = z.object({
  nom: z.string().min(2).max(80).optional(),
  couleur: couleurHex.optional(),
  rubriques: z.array(z.string().min(1).max(120)).optional(),
  actif: z.boolean().optional(),
  ordre: z.number().int().optional(),
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
