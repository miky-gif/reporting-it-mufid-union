# Cahier des charges — Plateforme de reporting d'activités IT

**MUFID UNION** — Réseau de microfinance, zone CEMAC, régulé COBAC
**Département de l'Exploitation Informatique (DEI)**

| | |
|---|---|
| **Document** | Cahier des charges fonctionnel et technique |
| **Version** | 2.0 (intègre les évolutions post-présentation) |
| **Date** | 8 juillet 2026 |
| **Statut** | À valider avant développement |
| **Rédaction** | Équipe projet |

> Ce document décrit **l'ensemble du projet** : le socle déjà réalisé (v1) et les **évolutions demandées (v2)** à développer. Chaque exigence porte un identifiant (`EF` = exigence fonctionnelle, `RG` = règle de gestion, `MD` = modèle de données, `ENF` = exigence non fonctionnelle) pour un suivi de développement direct. Les décisions à confirmer sont regroupées au **chapitre 12**.

---

## 1. Contexte et objectifs

### 1.1 Contexte
Le Département de l'Exploitation Informatique de MUFID UNION assure le support, la maintenance, l'infrastructure et le reporting pour l'ensemble des entités du réseau (les « MUFID »). Le suivi des activités des agents IT se fait aujourd'hui manuellement (fichiers Word hebdomadaires), sans consolidation ni pilotage.

### 1.2 Objectif du projet
Fournir une **plateforme web centralisée** permettant :
- aux **agents IT** de saisir et suivre leurs activités ;
- à l'**administrateur (responsable DEI)** d'affecter des tâches, de **valider (clôturer)** les activités réalisées, de piloter la charge et la performance, et de **générer les rapports** individuels et consolidés au format officiel (Word, PDF, Excel).

### 1.3 Objectifs des évolutions v2 (issus de la présentation)
1. Fiabiliser les indicateurs : ne compter comme « réalisé » que ce que l'admin a **validé/clôturé**.
2. Introduire un **système de points (pondération)** basé sur la durée pour mesurer objectivement la performance.
3. Renforcer le pilotage visuel : **codes couleur**, **activités en retard**, **top et flop contributeurs**.
4. Enrichir la saisie : **consignes vs état d'exécution**, **durée en minutes**, **pièces jointes**, **affectation multiple**.
5. Compléter les exports (**Excel**).

---

## 2. Périmètre

### 2.1 Dans le périmètre
- Authentification et gestion des comptes (admin / agent IT).
- Gestion dynamique des catégories et rubriques.
- Cycle de vie complet des tâches/activités (création, affectation, suivi, validation).
- Notifications (plateforme + e-mail).
- Tableaux de bord admin et agent.
- Rapports individuels et consolidés (Word, PDF, Excel).
- Système de points / pondération.
- Pièces jointes.

### 2.2 Hors périmètre (à ce stade)
- Application mobile native.
- Intégration directe avec les logiciels métier (CLOUDBANK, ESESAME, REPORTXPRO) — les activités restent saisies manuellement.
- Gestion de la paie / RH.

---

## 3. Acteurs et rôles

| Rôle | Description | Droits principaux |
|---|---|---|
| **Administrateur (DEI)** | Responsable du département | Tout : comptes, catégories, affectation, **validation/clôture**, modification de toute tâche, consignes, rapports, exports |
| **Agent IT (Employé)** | Technicien / ingénieur | Crée ses activités, met à jour l'**état d'exécution** et le **statut** (sauf clôture), consulte ses rapports |

> **Principe de confiance encadrée** : l'agent IT déclare son avancement, mais **seul l'admin valide** (clôture). Cela répond au risque qu'un agent déclare « terminé » une tâche qui ne l'est pas (voir RG-05).

---

## 4. Règles de gestion (cœur métier)

### 4.1 Cycle de vie d'une tâche

Statuts (v2) :

| Code | Libellé | Qui l'applique | Sens |
|---|---|---|---|
| `A_FAIRE` | À faire | Admin (à l'affectation) | Tâche planifiée, non commencée |
| `EN_COURS` | En cours | Agent / Admin | Travail en cours |
| `STANDBY` | Standby *(ex-« Bloqué »)* | Agent / Admin | En attente d'un élément externe |
| `TERMINE` | Terminé | Agent / Admin | L'agent déclare avoir fini (**non encore validé**) |
| `CLOTURE` | Clôturé | **Admin uniquement** | Validation finale : la tâche est **officiellement réalisée** |

- **RG-01** — Le statut `A_FAIRE` ne peut être posé que par l'admin (à l'affectation). *(existant, conservé)*
- **RG-02** — Le statut `CLOTURE` ne peut être posé **que par l'admin**, y compris sur une tâche créée par un agent.
- **RG-03** — **Renommage** : le statut `BLOQUE` devient `STANDBY` (libellé « Standby »). Migration des données existantes.
- **RG-04** — Une tâche est considérée **« réalisée / validée »** **si et seulement si** son statut est `CLOTURE`. `TERMINE` ne suffit pas.
- **RG-05** — L'admin peut **modifier le statut** de toute tâche (y compris repasser un `TERMINE` déclaré par l'agent à `EN_COURS`) et **ajouter/modifier une consigne**.

Enchaînement type : `A_FAIRE → EN_COURS → TERMINE → CLOTURE` (avec `STANDBY` possible à tout moment avant clôture).

### 4.2 Consignes vs état d'exécution

- **RG-06** — Le champ unique actuel « État d'exécution / consignes » est **scindé en deux** :
  - **`consignes`** (« Consigne de départ ») : les attentes/instructions. **Modifiable par l'admin uniquement.**
  - **`etat_execution`** (« État d'exécution de l'activité ») : le compte-rendu des actions menées. **Modifiable par l'agent** (y compris sur une tâche affectée par l'admin) **et par l'admin**.
- **RG-07** — Sur une tâche **affectée par l'admin**, l'agent peut modifier : `etat_execution`, `statut` (hors `CLOTURE`), `livrable`, `activites_a_mener`. Il **ne peut pas** modifier : `consignes`, `categorie`, `rubrique`, `priorite`, `duree`, la ou les personnes affectées. *(Étend la règle v1 « statut seul » en autorisant l'état d'exécution.)*

### 4.3 Durée et pondération (points)

- **RG-08** — La **durée** d'une tâche est saisie **manuellement, en minutes** (granularité fine : une tâche peut durer 15 min). Champ ouvert (pas de liste figée). Affichage lisible dérivé (ex. « 1 h 15 »).
- **RG-09** — **Pondération / points.** Chaque tâche vaut un nombre de points proportionnel à sa durée. **Référence : 40 h de travail = 5 points**, soit :

  ```
  points = duree_minutes ÷ 480
  ```

  (car 40 h = 2 400 min et 2 400 ÷ 480 = 5 ; donc 8 h = 1 point ; 15 min ≈ 0,031 pt).
- **RG-10** — Les points d'une tâche sont **acquis à la clôture** (`CLOTURE`) par l'admin. Une tâche non clôturée compte 0 point acquis (mais on peut afficher les points « potentiels »).
- **RG-11** — Le **score d'un agent** sur une période = somme des points des tâches clôturées qui lui sont affectées.

### 4.4 Retard

- **RG-12** — Une tâche est **en retard** si sa date d'échéance (`date_activite`) est dépassée **et** son statut n'est ni `TERMINE` ni `CLOTURE`.

### 4.5 Affectation multiple

- **RG-13** — Une même tâche peut être **affectée à plusieurs agents**. Décision de conception : chaque agent reçoit **sa propre instance** de la tâche (même intitulé, catégorie, consignes, échéance, durée), reliées par un identifiant de groupe d'affectation (`groupe_affectation_id`). Chaque instance a **son propre état d'exécution, statut et clôture** (un agent peut avoir terminé, un autre non). *(Voir point à valider 12.5.)*

---

## 5. Exigences fonctionnelles — Socle (v1, existant à conserver)

- **EF-01** — Authentification par e-mail + mot de passe, session JWT, rôles Admin/Agent.
- **EF-02** — Gestion des comptes par l'admin (création, modification, désactivation logique). Notification de bienvenue (e-mail + interne) avec identifiants.
- **EF-03** — Catégories dynamiques : l'admin crée/modifie des catégories et leurs **rubriques** (listes déroulantes en cascade dans le formulaire de tâche).
- **EF-04** — CRUD des activités avec filtres, recherche, tri, pagination. Un agent ne voit/modifie que ses activités ; l'admin voit tout.
- **EF-05** — Affectation d'une tâche par l'admin à un agent (statut initial `A_FAIRE`), avec notification (e-mail + interne).
- **EF-06** — Notifications internes + e-mail : création de compte, affectation, création de tâche par un agent, changement de statut, modification/suppression par l'admin.
- **EF-07** — Rapports individuel et consolidé au format du modèle métier (tableau par Rubriques), export **Word** et **PDF**.

---

## 6. Exigences fonctionnelles — Évolutions (v2, à développer)

### 6.1 Tableaux de bord

- **EF-10 — Heures réalisées (admin).** Sur le tableau de bord admin, remplacer « heures cumulées de toutes les tâches » par **« heures réalisées »** = somme des durées des tâches **clôturées** uniquement (RG-04). Afficher éventuellement en complément les heures « déclarées » (terminées non clôturées) à titre indicatif.
- **EF-11 — Activités en retard (agent).** Ajouter à la vue d'ensemble de l'agent IT un bloc **« Activités en retard »** (liste + compteur), selon RG-12.
- **EF-12 — Codes couleur (admin + agent).** Introduire une sémantique couleur cohérente dans les tableaux de bord et les listes :
  - 🔴 **Rouge** : en retard / critique / standby prolongé ;
  - 🟠 **Orange** : échéance proche (ex. ≤ 48 h) / priorité haute ;
  - 🟡 **Jaune** : en cours / à surveiller ;
  - 🟢 **Vert** : terminé / clôturé ;
  - ⚪ **Gris/neutre** : à faire.
  *(Palette exacte à caler sur la charte pétrole existante — voir 12.6.)*
- **EF-13 — Top et Flop contributeurs (admin).** Le bloc « Top contributeurs » affiche à la fois le **Top (up)** — meilleurs contributeurs — **et le Flop (down)** — les moins performants — sur la période, classés par **points acquis** (RG-11) puis heures réalisées.

### 6.2 Formulaire de création / affectation de tâche

- **EF-14 — Deux champs distincts.** Remplacer le champ unique « État d'exécution / consignes » par :
  - **« Consigne de départ »** (`consignes`) — éditable admin uniquement (RG-06/07) ;
  - **« État d'exécution de l'activité »** (`etat_execution`) — éditable agent + admin.
- **EF-15 — 5 niveaux de priorité.** Passer de 4 à **5 niveaux**. Proposition d'échelle : `BASSE`, `MOYENNE`, `HAUTE`, `TRES_HAUTE`, `CRITIQUE` *(libellés à confirmer — 12.1)*. Codes couleur associés (EF-12).
- **EF-16 — Statut « Clôturé ».** Ajouter le statut `CLOTURE`, réservé à l'admin (RG-02). Bouton/action « Clôturer la tâche » côté admin.
- **EF-17 — Renommer « Bloqué » → « Standby »** (RG-03).
- **EF-18 — Durée en minutes, saisie libre.** Champ ouvert en minutes (RG-08), avec affichage converti (« 1 h 30 »). Suppression de la contrainte d'incrément d'heures.
- **EF-19 — Pièces jointes.** Permettre de **joindre un ou plusieurs fichiers** à une tâche (ex. rapport déjà numérisé), consultables/téléchargeables sur la plateforme. Types et taille limités (12.4).
- **EF-20 — Affectation multiple.** Permettre d'affecter une même tâche à **plusieurs agents** en une action (RG-13). Notification de chaque destinataire.
- **EF-21 — Admin peut agir sur toute tâche créée par un agent.** L'admin peut, sur une tâche créée par un agent : ajouter/modifier la **consigne**, modifier le **statut** (dont clôture), sans que l'agent ait à réintervenir (RG-05).

### 6.3 Rapports et exports

- **EF-22 — « Résultat obtenu » → « Résultat attendu ».** Renommer la colonne/le libellé « Résultat obtenu (livrable) » en **« Résultat attendu »** dans les rapports (Word, PDF, aperçus).
- **EF-23 — Export Excel.** (Ré)implémenter l'export **Excel (.xlsx)** des rapports individuel et consolidé, en respectant la même grille (Rubriques, colonnes du modèle, colonne Statut, etc.). Les trois formats coexistent : Word, PDF, Excel.
- **EF-24 — Colonne Statut fonctionnelle** *(déjà livrée v1.1, rappel)* : la colonne « Statut » affiche le statut réel de la tâche (avec code couleur) ; la colonne « % réalisation » est supprimée.

---

## 7. Modèle de données (évolutions)

### 7.1 Table `activites` — champs ajoutés / modifiés

| Champ | Type | Évolution | Règle |
|---|---|---|---|
| `duree_minutes` | INTEGER | **Nouveau** (remplace `duree_heures`) | RG-08 ; migration : `duree_minutes = round(duree_heures × 60)` |
| `consignes` | TEXT | **Nouveau** | Éditable admin (RG-06) |
| `etat_execution` | TEXT | **Renommage** de `description` | Éditable agent + admin |
| `livrable` | TEXT | Existant | Libellé rapport → « Résultat attendu » (EF-22) |
| `activites_a_mener` | TEXT | Existant | — |
| `statut` | ENUM | **+ `CLOTURE`**, **`BLOQUE`→`STANDBY`** | RG-01..05 |
| `priorite` | ENUM | **5 niveaux** | EF-15 |
| `points` | DECIMAL(6,3) | **Nouveau (calculé)** | `duree_minutes ÷ 480` (RG-09) ; acquis si `CLOTURE` |
| `assignee_par_admin` | BOOLEAN | Existant | RG-07 |
| `groupe_affectation_id` | STRING/UUID | **Nouveau (nullable)** | Relie les instances d'une affectation multiple (RG-13) |
| `date_cloture` | DATETIME | **Nouveau (nullable)** | Renseignée à la clôture admin |
| `cloture_par` | INTEGER (FK users) | **Nouveau (nullable)** | Traçabilité de la validation |

### 7.2 Nouvelle table `pieces_jointes`

| Champ | Type | Description |
|---|---|---|
| `id` | PK | — |
| `activite_id` | FK activites | Tâche liée |
| `nom_fichier` | STRING | Nom d'origine |
| `chemin` / `stockage` | STRING | Emplacement (dossier `uploads/` ou blob) |
| `mime` | STRING | Type MIME |
| `taille` | INTEGER | Octets |
| `televerse_par` | FK users | Auteur |
| `date_creation` | DATETIME | — |

### 7.3 Affectation multiple

Option retenue (RG-13) : pas de table M:N ; on duplique l'activité par destinataire avec un `groupe_affectation_id` commun. *(Alternative M:N décrite en 12.5.)*

---

## 8. Spécifications des écrans

### 8.1 Tableau de bord Administrateur
- Cartes de synthèse : total activités, agents actifs, **heures réalisées (clôturées)** (EF-10), taux de clôture, **total des points acquis**.
- Répartition par catégorie et par statut (avec `CLOTURE` et `STANDBY`).
- **Top / Flop contributeurs** par points (EF-13).
- Charge par agent, évolution mensuelle.
- **Codes couleur** partout (EF-12).

### 8.2 Tableau de bord Agent IT
- Cartes : tâches du jour, en cours, standby, **en retard** (EF-11), terminées (semaine), **mes points** (acquis / potentiels).
- Bloc **Activités en retard** (liste rouge).
- Répartitions et activité de la semaine, en couleurs (EF-12).

### 8.3 Formulaire de tâche (création / édition / affectation)
Ordre des champs : **Catégorie → Rubrique → Consigne de départ (admin) → État d'exécution (agent) → Résultat attendu (livrable) → Activités à mener → Durée (minutes) → Date/échéance → Priorité (5) → Statut → Affecté à (multi) → Pièces jointes**.
- Verrouillages selon rôle (RG-06/07) et affectation.
- Action admin « Clôturer » (EF-16).

---

## 9. Rapports

- Structure conservée (en-tête modèle + tableau par Rubriques ; consolidé avec colonne Agent).
- **Colonnes** : Rubriques · Activités programmées · Description de l'activité · **Résultat attendu** (EF-22) · **Statut** (couleur) · Activités à mener.
- **Formats** : Word (.docx), PDF, **Excel (.xlsx)** (EF-23).
- Filtre de période ; le consolidé agrège tout le personnel.
- Option souhaitable : filtrer sur les tâches **clôturées** pour un rapport « officiel » (à confirmer 12.7).

---

## 10. Exigences non fonctionnelles

- **ENF-01 — Langue** : intégralement en français.
- **ENF-02 — Charte** : bleu pétrole MUFID UNION, typographie IBM Plex, cohérence visuelle.
- **ENF-03 — Sécurité** : mots de passe hachés (bcrypt), JWT, contrôle d'accès par rôle côté serveur (jamais uniquement côté client), validation des entrées.
- **ENF-04 — Pièces jointes** : contrôle du type MIME et de la taille ; noms de fichiers assainis ; stockage hors racine web public.
- **ENF-05 — Fiabilité des données** : opérations destructrices (seed) protégées par garde-fou ; migrations idempotentes.
- **ENF-06 — Performance** : pagination, index sur les colonnes filtrées.
- **ENF-07 — Portabilité** : fonctionne sous Windows (environnement de dev actuel : Node.js + MariaDB/XAMPP).
- **ENF-08 — Traçabilité** : date/auteur de clôture conservés.

---

## 11. Architecture technique (rappel de l'existant)

- **Backend** : Node.js + Express + Sequelize (MariaDB), JWT, zod (validation), nodemailer (e-mail), pdfkit (PDF), docx (Word), exceljs (Excel), multer ou équivalent (upload — à ajouter).
- **Frontend** : React 18 + TypeScript + Vite + Tailwind CSS + recharts + lucide-react + react-hook-form + zod.
- **Base** : MariaDB 10.4, base `mufid_activites`, création et migrations automatiques au démarrage.

---

## 12. Points à valider avant développement

1. **12.1 — Libellés des 5 priorités.** Proposition : Basse · Moyenne · Haute · Très haute · Critique. (« Haute » existe déjà en v1 ; confirmer le 5ᵉ niveau et son nom.)
2. **12.2 — Points/pondération.** Confirmer la référence **40 h = 5 points** et l'acquisition **à la clôture** (et non à « Terminé »). Faut-il afficher aussi des points « potentiels » ?
3. **12.3 — Heures réalisées.** Confirmer que « réalisé » = **clôturé** (et non « terminé »).
4. **12.4 — Pièces jointes.** Types autorisés (PDF, Word, Excel, images ?) et taille max par fichier (ex. 10 Mo) ; nombre max par tâche.
5. **12.5 — Affectation multiple.** Valider l'option « une instance par agent reliée par groupe » (recommandée) plutôt qu'une tâche partagée unique. Impact : chaque agent a son propre statut/clôture/points.
6. **12.6 — Palette de couleurs.** Valider les seuils (ex. « échéance proche » = ≤ 48 h) et les teintes exactes.
7. **12.7 — Rapports officiels.** Un rapport doit-il inclure toutes les activités de la période, ou uniquement les **clôturées** (option ou réglage) ?
8. **12.8 — Historique des durées.** La bascule heures → minutes s'applique-t-elle rétroactivement aux données existantes (migration proposée : ×60) ?

---

## 13. Lots de livraison proposés (indicatif)

| Lot | Contenu | Dépendances |
|---|---|---|
| **L1 — Modèle & statuts** | `CLOTURE`, `STANDBY`, 5 priorités, durée en minutes, consignes/état, points | Migrations |
| **L2 — Règles & permissions** | Clôture admin, verrouillages agent, calcul des points | L1 |
| **L3 — Tableaux de bord** | Heures réalisées, en retard, couleurs, top/flop | L2 |
| **L4 — Affectation multiple & pièces jointes** | Multi-affectation, upload/téléchargement | L1 |
| **L5 — Rapports** | « Résultat attendu », export Excel | L2 |

---

## 14. Récapitulatif des demandes de la présentation → exigences

| Demande exprimée | Exigence(s) |
|---|---|
| Heures cumulées = tâches **réalisées** (clôturées par l'admin) | EF-10, RG-04 |
| « Résultat obtenu » → « Résultat attendu » | EF-22 |
| Activités **en retard** sur la vue agent | EF-11, RG-12 |
| **Couleurs** dans les tableaux de bord (rouge/orange/jaune…) | EF-12 |
| Top contributeurs : **top up + top down** | EF-13 |
| Séparer **consignes** et **état d'exécution** | EF-14, RG-06/07 |
| Agent : état d'exécution oui, consignes non ; admin peut tout ajuster | RG-05/07, EF-21 |
| **5ᵉ priorité** | EF-15 |
| Statut **Clôturé** (admin only) | EF-16, RG-02 |
| **Bloqué → Standby** | EF-17, RG-03 |
| Durée **libre, en minutes** | EF-18, RG-08 |
| **Pondération / points** (40 h = 5 pts) | EF-13, RG-09/10/11 |
| **Pièces jointes** | EF-19, MD `pieces_jointes` |
| **Affectation multiple** | EF-20, RG-13 |
| **Export Excel** | EF-23 |

---

*Fin du cahier des charges — version 2.0. À valider (chapitre 12) avant démarrage du développement.*
