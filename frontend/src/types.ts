// Types partagés, alignés sur les schémas Pydantic du backend.

export type Role = "EMPLOYE" | "ADMIN";

// La catégorie est désormais dynamique (gérée par l'admin) : c'est un code libre.
export type Categorie = string;

export interface CategorieDef {
  id: number;
  code: string;
  nom: string;
  couleur: string;
  rubriques: string[];
  ordre: number;
  actif: boolean;
}

export type Priorite = "BASSE" | "MOYENNE" | "HAUTE" | "CRITIQUE";
export type Statut = "A_FAIRE" | "EN_COURS" | "TERMINE" | "BLOQUE";

export interface User {
  id: number;
  nom_complet: string;
  email: string;
  poste: string | null;
  role: Role;
  actif: boolean;
  date_creation: string;
}

export interface UserWithStats extends User {
  nb_activites: number;
}

export interface Activite {
  id: number;
  user_id: number;
  reference: string;
  titre: string;
  description: string | null;
  livrable: string | null;
  activites_a_mener: string | null;
  assignee_par_admin: boolean;
  categorie: Categorie;
  priorite: Priorite;
  statut: Statut;
  date_activite: string;
  duree_heures: number;
  date_creation: string;
  date_modification: string;
  user?: { id: number; nom_complet: string; poste: string | null } | null;
}

export interface PageActivites {
  items: Activite[];
  total: number;
  page: number;
  taille: number;
  total_pages: number;
}

export interface Repartition {
  cle: string;
  libelle: string;
  total: number;
  pourcentage: number;
  couleur?: string; // fourni pour les catégories (sinon indéfini)
}

export interface SerieJour {
  jour: string;
  valeur: number;
}
export interface SerieMois {
  mois: string;
  valeur: number;
}

export interface ChargeEmploye {
  user_id: number;
  nom_complet: string;
  initiales: string;
  heures: number;
  nb_activites: number;
}

export interface StatsEmploye {
  taches_du_jour: number;
  en_cours: number;
  bloquees: number;
  terminees_semaine: number;
  total_activites: number;
  heures_cumulees: number;
  taux_completion: number;
  repartition_statut: Repartition[];
  repartition_categorie: Repartition[];
  activite_semaine: SerieJour[];
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  titre: string;
  message: string;
  activite_id: number | null;
  lu: boolean;
  date_creation: string;
}

export interface NotificationsReponse {
  items: Notification[];
  non_lues: number;
}

export interface StatsAdmin {
  total_activites: number;
  employes_actifs: number;
  taux_completion: number;
  heures_cumulees: number;
  repartition_categorie: Repartition[];
  repartition_statut: Repartition[];
  charge_par_employe: ChargeEmploye[];
  top_contributeurs: ChargeEmploye[];
  evolution_mensuelle: SerieMois[];
}
