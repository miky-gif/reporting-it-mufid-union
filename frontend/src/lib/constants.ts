// Libellés français, couleurs et métadonnées des énumérations (alignés sur la maquette).
import type { Categorie, Priorite, Statut } from "@/types";

export const CATEGORIES: Record<
  Categorie,
  { libelle: string; couleur: string }
> = {
  DEVELOPPEMENT: { libelle: "Développement", couleur: "#2F6FE0" },
  CYBERSECURITE: { libelle: "Cybersécurité", couleur: "#7E57C2" },
  INFRASTRUCTURE: { libelle: "Infrastructure/Réseau", couleur: "#0E5E7C" },
  SUPPORT: { libelle: "Support", couleur: "#1F9D74" },
  MAINTENANCE: { libelle: "Maintenance", couleur: "#D08A21" },
  REPORTING: { libelle: "Reporting", couleur: "#64757D" },
  AUTRE: { libelle: "Autre", couleur: "#8A99A1" },
};

export const STATUTS: Record<
  Statut,
  { libelle: string; couleur: string; fond: string }
> = {
  TERMINE: { libelle: "Terminé", couleur: "#1B8A4B", fond: "#E4F5EB" },
  EN_COURS: { libelle: "En cours", couleur: "#14708F", fond: "#E1EFF4" },
  A_FAIRE: { libelle: "À faire", couleur: "#64757D", fond: "#EDF1F2" },
  BLOQUE: { libelle: "Bloqué", couleur: "#C0392B", fond: "#FBEAE7" },
};

export const PRIORITES: Record<
  Priorite,
  { libelle: string; couleur: string; fond: string }
> = {
  BASSE: { libelle: "Basse", couleur: "#1F9D74", fond: "#E4F4EE" },
  MOYENNE: { libelle: "Moyenne", couleur: "#14708F", fond: "#E1EFF4" },
  HAUTE: { libelle: "Haute", couleur: "#B4750E", fond: "#FBF0DC" },
  CRITIQUE: { libelle: "Critique", couleur: "#C0392B", fond: "#FBEAE7" },
};

export const LISTE_CATEGORIES = Object.keys(CATEGORIES) as Categorie[];
export const LISTE_STATUTS = ["A_FAIRE", "EN_COURS", "TERMINE", "BLOQUE"] as Statut[];
// Statuts disponibles pour l'employé : « À faire » est réservé à l'affectation par l'admin.
export const LISTE_STATUTS_EMPLOYE = ["EN_COURS", "TERMINE", "BLOQUE"] as Statut[];
export const LISTE_PRIORITES = ["BASSE", "MOYENNE", "HAUTE", "CRITIQUE"] as Priorite[];

// Rubriques prédéfinies par catégorie (la liste dépend de la catégorie choisie).
export const RUBRIQUES: Record<Categorie, string[]> = {
  DEVELOPPEMENT: [
    "Nouvelle fonctionnalité",
    "Correctif / Bug",
    "Revue de code",
    "Tests / Recette",
    "Intégration / API",
    "Déploiement / Mise en production",
    "Optimisation des performances",
    "Documentation technique",
  ],
  CYBERSECURITE: [
    "Analyse des logs",
    "Audit de sécurité",
    "Test d'intrusion",
    "Gestion des accès / droits",
    "Mise à jour antivirus",
    "Sensibilisation / Formation",
    "Gestion d'incident de sécurité",
  ],
  INFRASTRUCTURE: [
    "Configuration réseau",
    "Administration serveurs",
    "VPN / Accès distant",
    "Pare-feu",
    "Sauvegarde / Restauration",
    "Câblage / Matériel réseau",
    "Supervision / Monitoring",
  ],
  SUPPORT: [
    "Assistance utilisateur",
    "Réinitialisation de compte",
    "Installation de poste",
    "Incident matériel",
    "Formation utilisateur",
    "Ticket niveau 1",
  ],
  MAINTENANCE: [
    "Maintenance préventive",
    "Maintenance corrective",
    "Mise à jour logicielle",
    "Remplacement de matériel",
    "Optimisation / Nettoyage",
  ],
  REPORTING: [
    "Rapport mensuel",
    "Tableau de bord",
    "Export réglementaire COBAC",
    "Statistiques d'activité",
    "Documentation / Procédure",
  ],
  AUTRE: ["Réunion / Coordination", "Veille technologique", "Tâche diverse"],
};

// Couleur d'avatar déterministe à partir d'un identifiant.
const PALETTE_AVATAR = [
  "#0E5E7C", "#2F6FE0", "#1F9D74", "#7E57C2", "#D08A21", "#14708F", "#C0563B",
];
export function couleurAvatar(id: number): string {
  return PALETTE_AVATAR[id % PALETTE_AVATAR.length];
}
