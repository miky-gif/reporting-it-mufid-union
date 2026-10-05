// Génération des rapports Word (.docx) calqués sur le modèle métier.
// Deux tableaux : les activités de la période, puis les activités à mener
// (période suivante). Le type (Hebdomadaire/Mensuel/Annuel) est déduit de la période.
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalMergeType,
  WidthType,
} from "docx";

const PETROLE = "093646";
const PETROLE_CLAIR = "E3EDF1";
const PETROLE_TRES_CLAIR = "EEF4F6";
const BLEU = "0E5E7C";
const ENCRE = "16262E";
const GRIS = "5E717B";
const BORDURE = "C6D2D7";

const BORD = { style: BorderStyle.SINGLE, size: 4, color: BORDURE };
const BORDS_CELLULE = { top: BORD, bottom: BORD, left: BORD, right: BORD };

// Largeurs des colonnes, EXACTEMENT celles du PDF et du tableur : les trois
// formats doivent se superposer. Somme = 100.
const LARGEURS_IND = [14, 24, 28, 16, 8, 10]; // 6 colonnes
const LARGEURS_CONS = [12, 12, 20, 24, 14, 8, 10]; // 7 colonnes (Agent en tête)

// Largeur utile d'une page A4 paysage (16838 twips) moins les marges (2 × 720).
const LARGEUR_UTILE = 15398;

/** Convertit des pourcentages en largeurs absolues (twips). */
const enTwips = (pourcentages) => pourcentages.map((p) => Math.round((p / 100) * LARGEUR_UTILE));
const DXA_IND = enTwips(LARGEURS_IND);
const DXA_CONS = enTwips(LARGEURS_CONS);

function couleurStatutHex(statut) {
  if (statut === "Terminé") return "1B8A4B";
  if (statut === "Clôturé") return "0B6E39";
  if (statut === "En cours") return "0E5E7C";
  if (statut === "Standby") return "D2691E";
  return "5E717B"; // À faire / autre
}

function ligneTexte(texte, { bold = false, color = ENCRE, size = 18, align = AlignmentType.LEFT } = {}) {
  return new Paragraph({
    alignment: align,
    spacing: { after: 20 },
    children: [new TextRun({ text: texte, bold, color, size, font: "Calibri" })],
  });
}

function contenuMultiligne(texte, { size = 18 } = {}) {
  const lignes = String(texte || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lignes.length === 0) return [ligneTexte("", { size })];
  if (lignes.length === 1) return [ligneTexte(lignes[0], { size, color: ENCRE })];
  return lignes.map(
    (l) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 20 },
        children: [new TextRun({ text: l, size, color: ENCRE, font: "Calibri" })],
      }),
  );
}

// ⚠ La largeur doit être posée sur CHAQUE cellule. Déclarer seulement
// `columnWidths` sur le tableau ne suffit pas : Word applique alors son
// ajustement automatique et redimensionne les colonnes selon leur contenu.
function celluleEntete(texte, largeur) {
  return new TableCell({
    width: { size: largeur, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: PETROLE, color: "auto" },
    borders: BORDS_CELLULE,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [ligneTexte(texte, { bold: true, color: "FFFFFF", size: 18, align: AlignmentType.CENTER })],
  });
}

function cellule(children, { fill, merge, align, largeur } = {}) {
  const opts = {
    borders: BORDS_CELLULE,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: Array.isArray(children) ? children : [children],
  };
  if (largeur) opts.width = { size: largeur, type: WidthType.DXA };
  if (fill) opts.shading = { type: ShadingType.CLEAR, fill, color: "auto" };
  if (merge) opts.verticalMerge = merge;
  if (align) opts.verticalAlign = align;
  return new TableCell(opts);
}

// Cellule « Activités programmées » (rubrique) : fusionnée verticalement quand
// plusieurs tâches partagent la même rubrique (pg_span > 0 = 1re, 0 = continuation).
function celluleProgrammee(l, largeur) {
  if (l.pg_span === 0) {
    return cellule([new Paragraph({ children: [] })], { merge: VerticalMergeType.CONTINUE, align: "center", largeur });
  }
  return cellule([ligneTexte(l.programmee, { size: 18 })], { merge: VerticalMergeType.RESTART, align: "center", largeur });
}

// Les 3 cellules communes (description, résultat, statut, %) d'une ligne.
function cellulesCommunes(l, [lEtat, lLivrable, lStatut, lPct]) {
  return [
    cellule(contenuMultiligne(l.etat), { largeur: lEtat }),
    cellule(contenuMultiligne(l.livrable), { largeur: lLivrable }),
    cellule(
      [ligneTexte(l.statut, { bold: true, size: 18, color: couleurStatutHex(l.statut), align: AlignmentType.CENTER })],
      { align: "center", largeur: lStatut },
    ),
    cellule([ligneTexte(l.pourcentage, { bold: true, size: 18, align: AlignmentType.CENTER })],
      { align: "center", largeur: lPct }),
  ];
}

// -------------------------------------------------------------------------
// Tableau INDIVIDUEL (groupé par Rubriques)
// -------------------------------------------------------------------------
function tableauIndividuel(groupes, periodeCol) {
  const enTete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Rubriques", DXA_IND[0]),
      celluleEntete(`Activités programmées (${periodeCol})`, DXA_IND[1]),
      celluleEntete("Description de l'activité", DXA_IND[2]),
      celluleEntete("Résultat attendu (livrable)", DXA_IND[3]),
      celluleEntete("Statut", DXA_IND[4]),
      celluleEntete("% réalisation", DXA_IND[5]),
    ],
  });

  const lignes = [];
  for (const groupe of groupes) {
    groupe.lignes.forEach((l, i) => {
      const premiere = i === 0;
      lignes.push(
        new TableRow({
          children: [
            cellule(
              premiere ? [ligneTexte(groupe.rubrique, { bold: true, color: PETROLE, size: 18 })] : [new Paragraph({ children: [] })],
              { fill: PETROLE_CLAIR, merge: premiere ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE, align: "center", largeur: DXA_IND[0] },
            ),
            celluleProgrammee(l, DXA_IND[1]),
            ...cellulesCommunes(l, DXA_IND.slice(2)),
          ],
        }),
      );
    });
  }
  if (lignes.length === 0) lignes.push(ligneVide(6));

  return new Table({
    // Largeur absolue + disposition FIXE : Word respecte alors les colonnes
    // telles qu'elles sont déclarées, au lieu de les recalculer.
    width: { size: LARGEUR_UTILE, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: DXA_IND,
    rows: [enTete, ...lignes],
  });
}

// -------------------------------------------------------------------------
// Tableau CONSOLIDÉ (Agent -> Rubriques)
// -------------------------------------------------------------------------
function tableauConsolide(employes, periodeCol) {
  const enTete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Agent", DXA_CONS[0]),
      celluleEntete("Rubriques", DXA_CONS[1]),
      celluleEntete(`Activités programmées (${periodeCol})`, DXA_CONS[2]),
      celluleEntete("Description de l'activité", DXA_CONS[3]),
      celluleEntete("Résultat attendu (livrable)", DXA_CONS[4]),
      celluleEntete("Statut", DXA_CONS[5]),
      celluleEntete("% réalisation", DXA_CONS[6]),
    ],
  });

  const lignes = [];
  for (const emp of employes) {
    let premiereEmp = true;
    for (const groupe of emp.groupes) {
      groupe.lignes.forEach((l, i) => {
        const premiereCat = i === 0;
        const celluleAgent = premiereEmp
          ? cellule(
              [
                ligneTexte(emp.nom_complet.toUpperCase(), { bold: true, color: ENCRE, size: 18, align: AlignmentType.CENTER }),
                ...(emp.poste ? [ligneTexte(emp.poste, { color: GRIS, size: 15, align: AlignmentType.CENTER })] : []),
              ],
              { fill: PETROLE_TRES_CLAIR, merge: VerticalMergeType.RESTART, align: "center", largeur: DXA_CONS[0] },
            )
          : cellule([new Paragraph({ children: [] })], { fill: PETROLE_TRES_CLAIR, merge: VerticalMergeType.CONTINUE, align: "center", largeur: DXA_CONS[0] });
        const celluleRubrique = premiereCat
          ? cellule([ligneTexte(groupe.rubrique, { bold: true, color: BLEU, size: 18 })], {
              fill: PETROLE_CLAIR, merge: VerticalMergeType.RESTART, align: "center", largeur: DXA_CONS[1],
            })
          : cellule([new Paragraph({ children: [] })], { fill: PETROLE_CLAIR, merge: VerticalMergeType.CONTINUE, align: "center", largeur: DXA_CONS[1] });

        lignes.push(
          new TableRow({
            children: [celluleAgent, celluleRubrique, celluleProgrammee(l, DXA_CONS[2]), ...cellulesCommunes(l, DXA_CONS.slice(3))],
          }),
        );
        premiereEmp = false;
      });
    }
  }
  if (lignes.length === 0) lignes.push(ligneVide(7));

  return new Table({
    width: { size: LARGEUR_UTILE, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: DXA_CONS,
    rows: [enTete, ...lignes],
  });
}

function ligneVide(span) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: span,
        // La cellule couvre toute la largeur : sinon Word rétrécit le tableau
        // vide et il n'a plus la même emprise que les tableaux garnis.
        width: { size: LARGEUR_UTILE, type: WidthType.DXA },
        borders: BORDS_CELLULE,
        margins: { top: 80, bottom: 80, left: 80, right: 80 },
        children: [ligneTexte("Aucune activité sur cette période.", { color: GRIS, align: AlignmentType.CENTER })],
      }),
    ],
  });
}

// En-tête du document (titre + type détecté + période + département + ligne).
function enTeteDocument({ typeLabel, debut_court, fin_court, departement, ligne }) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 40 },
      children: [new TextRun({ text: `RAPPORT D'ACTIVITÉS ${typeLabel || ""}`.trim(), bold: true, size: 32, color: ENCRE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: `Du ${debut_court} au ${fin_court}`, bold: true, size: 24, color: BLEU })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: departement, size: 22, color: GRIS })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [ligne],
    }),
  ];
}

// Intitulé au-dessus d'un tableau.
function titreTableau(texte, couleur = ENCRE) {
  return new Paragraph({
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text: texte, bold: true, size: 22, color: couleur })],
  });
}

function pied(reference) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200 },
    children: [
      new TextRun({ text: `Référence : ${reference} · Document interne · MUFID UNION`, italics: true, size: 16, color: GRIS }),
    ],
  });
}

const docPaysage = (children) =>
  new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [
      {
        properties: {
          page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } },
        },
        children,
      },
    ],
  });

// `inclureAMener` : ajoute le 2e tableau (activités à mener). Par défaut, seul le
// premier tableau (activités de la période) est exporté.
export async function rapportHebdoWord(rap, inclureAMener = false) {
  const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;
  const periodeSuiv = `du ${rap.debut_suivant_court} au ${rap.fin_suivant_court}`;

  const children = [
    ...enTeteDocument({
      typeLabel: rap.type_label,
      debut_court: rap.debut_court,
      fin_court: rap.fin_court,
      departement: rap.departement,
      ligne: new TextRun({
        text: rap.user.nom_complet.toUpperCase() + (rap.user.poste ? `  —  ${rap.user.poste}` : ""),
        bold: true,
        size: 24,
        color: ENCRE,
      }),
    }),
    titreTableau(`Activités de la période — ${periodeCol}`),
    tableauIndividuel(rap.groupes, periodeCol),
  ];
  if (inclureAMener) {
    children.push(
      titreTableau(`Activités à mener (${rap.suivant_label}) — ${periodeSuiv}`, BLEU),
      tableauIndividuel(rap.groupes_a_mener, periodeSuiv),
    );
  }
  children.push(pied(rap.reference));

  return Packer.toBuffer(docPaysage(children));
}

export async function rapportConsolideHebdoWord(rap, inclureAMener = false) {
  const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;
  const periodeSuiv = `du ${rap.debut_suivant_court} au ${rap.fin_suivant_court}`;

  const children = [
    ...enTeteDocument({
      typeLabel: `${rap.type_label} — consolidé`,
      debut_court: rap.debut_court,
      fin_court: rap.fin_court,
      departement: rap.departement,
      ligne: new TextRun({
        text: `Ensemble du personnel · ${rap.nb_employes} agent(s) · ${rap.nb_activites} activité(s)`,
        bold: true,
        size: 22,
        color: ENCRE,
      }),
    }),
    titreTableau(`Activités de la période — ${periodeCol}`),
    tableauConsolide(rap.employes, periodeCol),
  ];
  if (inclureAMener) {
    children.push(
      titreTableau(`Activités à mener (${rap.suivant_label}) — ${periodeSuiv}`, BLEU),
      tableauConsolide(rap.employes_a_mener, periodeSuiv),
    );
  }
  children.push(pied(rap.reference));

  return Packer.toBuffer(docPaysage(children));
}
