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

export type Priorite = "BASSE" | "MOYENNE" | "HAUTE" | "TRES_HAUTE" | "CRITIQUE";
export type Statut = "A_FAIRE" | "EN_COURS" | "STANDBY" | "TERMINE" | "CLOTURE";

export interface PieceJointe {
  id: number;
  nom_fichier: string;
  mime: string | null;
  taille: number;
  date_creation: string;
}

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
  description: string | null; // état d'exécution de l'activité
  consignes: string | null;
  livrable: string | null;
  activites_a_mener: string | null;
  assignee_par_admin: boolean;
  groupe_affectation_id: string | null;
  categorie: Categorie;
  priorite: Priorite;
  statut: Statut;
  pourcentage: number; // % réalisation (0-100)
  date_activite: string; // échéance (= date_fin)
  date_debut: string;
  date_fin: string;
  duree_minutes: number;
  duree_heures: number;
  points: number;
  points_acquis: number;
  en_retard: boolean;
  date_cloture: string | null;
  cloture_par: number | null;
  reaffectee: boolean;
  reaffectee_de: number | null;
  date_reaffectation: string | null;
  motif_reaffectation: string | null;
  date_creation: string;
  date_modification: string;
  user?: { id: number; nom_complet: string; poste: string | null } | null;
  pieces?: PieceJointe[];
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
  minutes: number; // durée exacte (source de vérité)
  heures: number; // dérivé, pour affichage décimal éventuel
  nb_activites: number;
  cloturees?: number;
  points?: number;
}

export interface ActiviteEnRetard {
  id: number;
  titre: string;
  categorie: string;
  date_activite: string;
  statut: string;
  priorite: string;
}

export interface StatsEmploye {
  taches_du_jour: number;
  en_cours: number;
  en_standby: number;
  en_retard: number;
  terminees_semaine: number;
  cloturees: number;
  total_activites: number;
  minutes_realisees: number;
  minutes_total: number;
  heures_realisees: number;
  points_acquis: number;
  points_potentiels: number;
  taux_completion: number;
  repartition_statut: Repartition[];
  repartition_categorie: Repartition[];
  activite_semaine: SerieJour[];
  activites_en_retard: ActiviteEnRetard[];
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

/* ---- Écran « Statistiques » (admin) --------------------------------- */
export interface RepartitionStat {
  cle: string;
  libelle: string;
  couleur?: string;
  total: number;
  minutes: number;
  heures: number;
  points: number;
  pourcentage: number;
}

export interface AgentStat {
  user_id: number;
  nom_complet: string;
  poste: string;
  total: number;
  cloturees: number;
  en_retard: number;
  minutes: number;
  heures: number;
  minutes_realisees: number;
  points: number;
  taux_cloture: number;
}

export interface RetardStat {
  id: number;
  reference: string;
  titre: string;
  agent: string;
  categorie: string;
  priorite: string;
  statut: string;
  echeance: string;
  jours_retard: number;
  pourcentage: number;
}

export interface StatsAvancees {
  debut: string;
  fin: string;
  periode: string;
  debut_court: string;
  fin_court: string;
  synthese: {
    total_activites: number;
    cloturees: number;
    terminees: number;
    en_cours: number;
    standby: number;
    a_faire: number;
    en_retard: number;
    nb_agents: number;
    minutes_total: number;
    minutes_realisees: number;
    heures_total: number;
    heures_realisees: number;
    points_total: number;
    taux_cloture: number;
    taux_retard: number;
    duree_moyenne_minutes: number;
  };
  repartition_statut: RepartitionStat[];
  repartition_priorite: RepartitionStat[];
  repartition_categorie: RepartitionStat[];
  par_agent: AgentStat[];
  activites_en_retard: RetardStat[];
  evolution_mensuelle: { mois: string; total: number; cloturees: number; en_retard: number }[];
}

export interface StatsAdmin {
  total_activites: number;
  employes_actifs: number;
  cloturees: number;
  en_retard: number;
  taux_completion: number;
  minutes_realisees: number;
  heures_realisees: number;
  points_total: number;
  repartition_categorie: Repartition[];
  repartition_statut: Repartition[];
  charge_par_employe: ChargeEmploye[];
  top_contributeurs: ChargeEmploye[];
  evolution_mensuelle: SerieMois[];
}
