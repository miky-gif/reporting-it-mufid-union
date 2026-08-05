# Brief de présentation — MUFID UNION · Plateforme de reporting IT

> **À l'attention de « Claude design ».**
> Ce document est un *brief*. Merci de me proposer un **PowerPoint simple, clair et professionnel** (12 à 14 diapositives) présentant le projet ci-dessous à une direction générale et à un régulateur interne (contexte microfinance, zone CEMAC / COBAC).
> Public : **non-technique** (direction, audit, DSI). Ton : sobre, institutionnel, rassurant. Langue : **français**.
> Un plan diapo-par-diapo est fourni plus bas — vous pouvez le suivre ou l'améliorer.

---

## 1. Le projet en une phrase

**MUFID UNION** est une plateforme web interne qui permet de **planifier, suivre et rapporter les activités des équipes informatiques** d'un établissement de microfinance, et de produire automatiquement les **rapports d'activité au format officiel de la maison** (hebdomadaire, mensuel, annuel).

---

## 2. Contexte & public cible

- Établissement de **microfinance** soumis à la réglementation **COBAC / CEMAC** → traçabilité et reporting régulier des activités sont attendus.
- Le **service informatique** est organisé en **plusieurs départements** (ex. Exploitation système, Infrastructure) avec un responsable par département.
- Aujourd'hui, le suivi et les rapports se font **manuellement** (Word / Excel), ce qui est **long, hétérogène et difficile à consolider**.
- Public de la présentation : **Direction générale, DSI, Audit / Contrôle interne**.

---

## 3. Le problème — et pourquoi pas GLPI ?

GLPI est un excellent outil **ITSM / gestion de parc / helpdesk** (inventaire du matériel, tickets d'incidents). Mais **dans notre besoin précis — planifier et rapporter les activités du personnel IT** — il montre des limites :

| Notre besoin | Limite de GLPI dans ce contexte | Ce que MUFID UNION apporte |
|---|---|---|
| Rapport au **format officiel** de la maison (Rubriques / Activités programmées, en Word) | Reporting générique et rigide ; le format maison exige des plugins/développements | Génère le rapport **exactement au bon format** (Word, PDF, Excel), en un clic |
| **Planifier** les activités à venir du personnel | Centré sur les **tickets/incidents**, pas sur la planification d'activités programmées | Création / affectation de tâches avec **période, durée, échéance** |
| **Noter la performance** d'un agent | Pas de système de points/scoring natif | **Points automatiques** (40 h = 5 pts) + **bonus/malus** décidé par le responsable |
| **Tâches récurrentes** avec relance | Pas de planification récurrente d'activités simple et adaptée | Récurrence **jour / semaine / mois** + **notification e-mail automatique** |
| **Cloisonnement** strict par département | Configuration multi-entités lourde | Cloisonnement **natif** : chaque admin ne voit que son département |
| **Simplicité** pour une petite équipe | Outil **lourd** à déployer, configurer et maintenir | Application **légère, ciblée**, prise en main immédiate |
| Contexte **microfinance / COBAC / francophone** | Outil **généraliste**, non aligné sur ce cadre | Pensé **sur mesure** pour ce contexte et cette terminologie |

> **Message clé à retenir :** *GLPI gère le parc et les incidents ; MUFID UNION gère le travail des équipes et son reporting réglementaire.* Les deux sont complémentaires — MUFID UNION comble un manque que GLPI ne couvre pas.

---

## 4. La solution : MUFID UNION

Une application web (accessible depuis le réseau de l'entreprise) organisée autour de **3 rôles** :

- **Super administrateur** — crée les **départements**, les **administrateurs**, définit leurs droits.
- **Administrateur (responsable de département)** — affecte les tâches, suit l'avancement, valide, exporte les rapports de **son** département.
- **IT (agent)** — consulte ses tâches, met à jour l'avancement et le statut, télécharge son propre rapport.

---

## 5. Fonctionnalités clés (à illustrer)

**Planification & suivi**
- Création / affectation de tâches (catégorie, rubrique, période début→fin, durée en heures/minutes, échéance).
- Réaffectation d'une tâche à un autre agent (avec **motif**, redéfinition de la période/durée, notification des deux agents).
- Statuts : À faire, En cours, Standby, Terminé, Clôturé, **En retard** (détecté automatiquement).
- **% de réalisation** par activité.
- **Tâches récurrentes** (jour/semaine/mois) générées automatiquement + e-mail.

**Performance**
- Points **automatiques** (40 h de travail = 5 points) + **ajustement bonus/malus** par le responsable.

**Reporting (le cœur du projet)**
- Rapports **individuels** et **consolidés** (tout le personnel d'un département).
- **Type détecté automatiquement** selon la période : Hebdomadaire / Mensuel / Annuel.
- Tableau groupé par **Rubriques → Activités programmées → Description → Résultat attendu → Statut → % réalisation**.
- Second tableau **« Activités à mener »** (période suivante) alimenté automatiquement.
- Export **Word, PDF et Excel** au format officiel.

**Pilotage & administration**
- **Tableau de bord** et onglet **Statistiques** (activités en retard, charge, performance) avec export Excel/PDF.
- **Cloisonnement par département** + permissions granulaires par administrateur.
- **Notifications e-mail** (une boîte d'envoi configurable par département).
- Catégories/rubriques propres à chaque département.

---

## 6. Bénéfices (slide « Résultats »)

- ⏱️ **Gain de temps** : rapport officiel généré en un clic au lieu d'une mise en forme manuelle.
- 📐 **Homogénéité** : tous les rapports sortent au même format, sans erreur de présentation.
- 👁️ **Traçabilité & transparence** : chaque activité est datée, chiffrée, suivie — utile pour l'audit et le régulateur.
- 📊 **Pilotage** : le responsable voit en temps réel la charge, les retards et la performance.
- 🎯 **Responsabilisation** : le système de points valorise le travail réellement fourni.
- 🪶 **Léger & sur mesure** : ciblé sur le besoin, sans la complexité d'un ITSM complet.

---

## 7. Identité visuelle (à respecter dans le PowerPoint)

- **Couleur principale — Bleu pétrole :** `#0B4A61` (foncé), `#0E5E7C` (moyen), `#14708F` (clair).
- **Fonds clairs :** `#F0F6F8`, `#F4F6F7`, blanc.
- **Neutres / texte :** encre `#16262E`, ardoise `#33454F`, gris `#5E717B`.
- **Couleurs sémantiques (statuts) :** succès `#1B8A4B`, info `#14708F`, attention `#D08A21`, danger/retard `#C0392B`.
- **Typographie :** *IBM Plex Sans* (ou une sans-serif sobre équivalente : Inter, Segoe UI).
- **Style :** épuré, institutionnel, beaucoup de blanc, icônes fines (style Lucide), pas de dégradés criards. Un liseré/bandeau bleu pétrole en en-tête de chaque diapo.

---

## 8. Plan proposé, diapositive par diapositive

**Diapo 1 — Couverture**
Titre : *MUFID UNION — Plateforme de reporting des activités IT*. Sous-titre : *Planifier · Suivre · Rapporter*. Logo/espace logo, fond bleu pétrole.

**Diapo 2 — Le constat / le problème**
Le suivi et les rapports d'activité IT sont manuels, chronophages, hétérogènes, difficiles à consolider et à auditer.

**Diapo 3 — Pourquoi pas (seulement) GLPI ?**
GLPI = parc & incidents. Notre besoin = planification et reporting des activités du personnel. Montrer le tableau comparatif simplifié (2–3 lignes fortes) de la section 3.

**Diapo 4 — La solution en un coup d'œil**
Schéma : une application web, 3 rôles (Super admin → Admin → IT), un objectif : le rapport officiel automatisé.

**Diapo 5 — Les 3 rôles**
Super administrateur / Administrateur de département / Agent IT, avec 1 phrase chacun.

**Diapo 6 — Planifier & affecter les tâches**
Période, durée, échéance, catégories, réaffectation avec motif. (Capture d'écran du formulaire.)

**Diapo 7 — Suivre l'avancement**
Statuts, % de réalisation, détection automatique des retards, tâches récurrentes. (Capture du tableau de bord.)

**Diapo 8 — Valoriser la performance**
Système de points (40 h = 5 pts) + bonus/malus. Schéma simple.

**Diapo 9 — Le rapport officiel automatisé (LE point fort)**
Avant/après : Word manuel ↔ rapport généré. Format Rubriques → Activités. Word / PDF / Excel. Type auto (hebdo/mensuel/annuel).

**Diapo 10 — Rapports consolidés & statistiques**
Vue consolidée de tout le département + tableau de bord statistique (retards, charge, performance) exportable.

**Diapo 11 — Sécurité & cloisonnement**
Chaque département cloisonné, permissions par admin, notifications e-mail par département, traçabilité complète.

**Diapo 12 — Bénéfices**
Les 6 bénéfices de la section 6, sous forme d'icônes + libellés courts.

**Diapo 13 — GLPI vs MUFID UNION : complémentaires**
Message : on ne remplace pas GLPI, on complète ce qu'il ne fait pas. (Deux colonnes.)

**Diapo 14 — Conclusion / prochaines étapes**
Statut du projet (opérationnel, en test sur le réseau interne), et prochaines étapes (déploiement, adresse e-mail professionnelle, formation des équipes).

---

## 9. Consignes de style pour le rendu

- **Une idée par diapo**, titres courts, 4 à 6 puces maximum.
- Privilégier **schémas, icônes et captures** au texte dense.
- Vocabulaire **non-technique** (public direction/audit).
- Garder la charte : bleu pétrole dominant, fond clair, IBM Plex Sans.
- Numéroter les diapos, pied de page discret « MUFID UNION · Document interne ».

---

## 10. Prompt prêt à coller (résumé)

> « Crée un PowerPoint professionnel et sobre de 14 diapositives pour présenter **MUFID UNION**, une plateforme web interne de **planification, suivi et reporting des activités IT** d'un établissement de microfinance (CEMAC/COBAC). Public : direction et audit, non-technique. Insiste sur : (1) le problème du reporting manuel, (2) pourquoi GLPI ne couvre pas ce besoin (GLPI = parc/incidents ; nous = activités & rapports réglementaires), (3) les 3 rôles, (4) la planification des tâches, (5) le suivi + détection des retards + récurrence, (6) le système de points, (7) **le rapport officiel généré automatiquement en Word/PDF/Excel** (point fort), (8) rapports consolidés & statistiques, (9) sécurité/cloisonnement par département, (10) bénéfices, (11) complémentarité avec GLPI. Charte : bleu pétrole #0B4A61 / #0E5E7C / #14708F, fonds clairs, typo IBM Plex Sans, style épuré et institutionnel. Suis le plan diapo-par-diapo fourni. »
