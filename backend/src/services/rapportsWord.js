// Génération du rapport individuel au format Word (.docx), calqué sur le
// modèle métier : tableau à 6 colonnes groupé par Rubriques (= catégorie).
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

// Largeurs relatives des 7 colonnes (en pourcentage, somme = 100).
const LARGEURS = [13, 17, 21, 14, 9, 8, 18];
// Rapport consolidé : 8 colonnes (Agent en tête). Somme = 100.
const LARGEURS_CONS = [11, 11, 15, 18, 12, 8, 7, 18];

// Couleur (hex sans #) associée au libellé de statut.
function couleurStatutHex(statut) {
  if (statut === "Terminé") return "1B8A4B";
  if (statut === "En cours") return "0E5E7C";
  if (statut === "Bloqué") return "C0392B";
  return "5E717B"; // À faire / autre
}

// Un paragraphe simple (une ligne de texte dans une cellule).
function ligneTexte(texte, { bold = false, color = ENCRE, size = 18, align = AlignmentType.LEFT } = {}) {
  return new Paragraph({
    alignment: align,
    spacing: { after: 20 },
    children: [new TextRun({ text: texte, bold, color, size, font: "Calibri" })],
  });
}

// Contenu multi-lignes : chaque ligne (séparée par \n) devient une puce.
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

function celluleEntete(texte) {
  return new TableCell({
    shading: { type: ShadingType.CLEAR, fill: PETROLE, color: "auto" },
    borders: BORDS_CELLULE,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [ligneTexte(texte, { bold: true, color: "FFFFFF", size: 18, align: AlignmentType.CENTER })],
  });
}

function cellule(children, { fill, merge, align } = {}) {
  const opts = {
    borders: BORDS_CELLULE,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: Array.isArray(children) ? children : [children],
  };
  if (fill) opts.shading = { type: ShadingType.CLEAR, fill, color: "auto" };
  if (merge) opts.verticalMerge = merge;
  if (align) opts.verticalAlign = align;
  return new TableCell(opts);
}

export async function rapportHebdoWord(rap) {
  const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;

  // En-tête du tableau.
  const enTete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Rubriques"),
      celluleEntete(`Activités programmées de la semaine ${periodeCol}`),
      celluleEntete("Description de l'activité"),
      celluleEntete("Résultat attendu (livrable)"),
      celluleEntete("Statut"),
      celluleEntete("% réalisation"),
      celluleEntete("Activités à mener au cours de la semaine suivante"),
    ],
  });

  // Lignes de données, groupées par Rubriques (catégorie) avec fusion verticale.
  const lignes = [];
  for (const groupe of rap.groupes) {
    groupe.lignes.forEach((l, i) => {
      const premiere = i === 0;
      lignes.push(
        new TableRow({
          children: [
            // Colonne Rubriques : fusionnée verticalement sur tout le groupe.
            cellule(
              premiere
                ? [ligneTexte(groupe.rubrique, { bold: true, color: PETROLE, size: 18 })]
                : [new Paragraph({ children: [] })],
              {
                fill: PETROLE_CLAIR,
                merge: premiere ? VerticalMergeType.RESTART : VerticalMergeType.CONTINUE,
                align: "center",
              },
            ),
            cellule([ligneTexte(l.programmee, { size: 18 })]),
            cellule(contenuMultiligne(l.etat)),
            cellule(contenuMultiligne(l.livrable)),
            cellule(
              [ligneTexte(l.statut, { bold: true, size: 18, color: couleurStatutHex(l.statut), align: AlignmentType.CENTER })],
              { align: "center" },
            ),
            cellule([ligneTexte(l.pourcentage, { bold: true, size: 18, align: AlignmentType.CENTER })], { align: "center" }),
            cellule(contenuMultiligne(l.aMener)),
          ],
        }),
      );
    });
  }

  if (lignes.length === 0) {
    lignes.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 7,
            borders: BORDS_CELLULE,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [
              ligneTexte("Aucune activité enregistrée sur cette période.", {
                color: GRIS,
                align: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
    );
  }

  const tableau = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: LARGEURS.map((p) => Math.round((p / 100) * 15000)),
    rows: [enTete, ...lignes],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 60 },
            children: [new TextRun({ text: "RAPPORT D'ACTIVITÉS", bold: true, size: 32, color: ENCRE })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [
              new TextRun({ text: `Du ${rap.debut_court} au ${rap.fin_court}`, bold: true, size: 24, color: PETROLE }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: rap.departement, size: 22, color: GRIS })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({ text: rap.user.nom_complet.toUpperCase(), bold: true, size: 24, color: ENCRE }),
              ...(rap.user.poste ? [new TextRun({ text: `  —  ${rap.user.poste}`, size: 22, color: GRIS })] : []),
            ],
          }),
          tableau,
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: `Référence : ${rap.reference} · Document interne · MUFID UNION`,
                italics: true,
                size: 16,
                color: GRIS,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// Bloc-titre commun aux rapports (centré).
function blocTitre({ sousTitre, ligne, departement }) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: "RAPPORT D'ACTIVITÉS", bold: true, size: 32, color: ENCRE })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: sousTitre, bold: true, size: 24, color: BLEU })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: ligne ? 60 : 240 },
      // Département dynamique (Infrastructure, Exploitation Système…).
      children: [new TextRun({ text: departement, size: 22, color: GRIS })],
    }),
    ...(ligne
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: ligne, bold: true, size: 22, color: ENCRE })],
          }),
        ]
      : []),
  ];
}

export async function rapportConsolideHebdoWord(rap) {
  const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;

  const enTete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Agent"),
      celluleEntete("Rubriques"),
      celluleEntete(`Activités programmées de la semaine ${periodeCol}`),
      celluleEntete("Description de l'activité"),
      celluleEntete("Résultat attendu (livrable)"),
      celluleEntete("Statut"),
      celluleEntete("% réalisation"),
      celluleEntete("Activités à mener au cours de la semaine suivante"),
    ],
  });

  const lignes = [];
  for (const emp of rap.employes) {
    // Nombre total de lignes de l'agent (pour la fusion verticale).
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
              { fill: PETROLE_TRES_CLAIR, merge: VerticalMergeType.RESTART, align: "center" },
            )
          : cellule([new Paragraph({ children: [] })], {
              fill: PETROLE_TRES_CLAIR,
              merge: VerticalMergeType.CONTINUE,
              align: "center",
            });
        const celluleRubrique = premiereCat
          ? cellule([ligneTexte(groupe.rubrique, { bold: true, color: BLEU, size: 18 })], {
              fill: PETROLE_CLAIR,
              merge: VerticalMergeType.RESTART,
              align: "center",
            })
          : cellule([new Paragraph({ children: [] })], {
              fill: PETROLE_CLAIR,
              merge: VerticalMergeType.CONTINUE,
              align: "center",
            });

        lignes.push(
          new TableRow({
            children: [
              celluleAgent,
              celluleRubrique,
              cellule([ligneTexte(l.programmee, { size: 18 })]),
              cellule(contenuMultiligne(l.etat)),
              cellule(contenuMultiligne(l.livrable)),
              cellule(
                [ligneTexte(l.statut, { bold: true, size: 18, color: couleurStatutHex(l.statut), align: AlignmentType.CENTER })],
                { align: "center" },
              ),
              cellule([ligneTexte(l.pourcentage, { bold: true, size: 18, align: AlignmentType.CENTER })], { align: "center" }),
              cellule(contenuMultiligne(l.aMener)),
            ],
          }),
        );
        premiereEmp = false;
      });
    }
  }

  if (lignes.length === 0) {
    lignes.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 8,
            borders: BORDS_CELLULE,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [
              ligneTexte("Aucune activité enregistrée sur cette période.", { color: GRIS, align: AlignmentType.CENTER }),
            ],
          }),
        ],
      }),
    );
  }

  const tableau = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: LARGEURS_CONS.map((p) => Math.round((p / 100) * 15000)),
    rows: [enTete, ...lignes],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          ...blocTitre({
            sousTitre: `Rapport consolidé — Du ${rap.debut_court} au ${rap.fin_court}`,
            ligne: `Ensemble du personnel · ${rap.nb_employes} agent(s) · ${rap.nb_activites} activité(s)`,
            departement: rap.departement,
          }),
          tableau,
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 200 },
            children: [
              new TextRun({
                text: `Référence : ${rap.reference} · Document interne · MUFID UNION`,
                italics: true,
                size: 16,
                color: GRIS,
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
