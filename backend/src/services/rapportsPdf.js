// Génération des rapports PDF avec pdfkit, aux couleurs MUFID UNION.
import PDFDocument from "pdfkit";

const BLEU = "#0E5E7C";
const PETROLE_HDR = "#093646";
const PETROLE_CLAIR = "#E3EDF1";
const PETROLE_TRES_CLAIR = "#EEF4F6";
const ENCRE = "#16262E";
const GRIS = "#5E717B";
const GRIS_CLAIR = "#F4F6F7";
const VERT = "#1B8A4B";
const BORDURE = "#C6D2D7";
const M = 40; // marge

const fmtH = (h) => `${Number.isInteger(h) ? h : String(h).replace(".", ",")} h`;

function couleurStatut(statut) {
  if (statut === "Terminé") return VERT;
  if (statut === "En cours") return BLEU;
  if (statut === "Bloqué") return "#C0392B";
  return GRIS;
}

// Rend le document en Buffer.
function rendre(construire) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: M });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    construire(doc);
    doc.end();
  });
}

const W = () => 595.28 - 2 * M; // largeur utile

function entete(doc, titre, sousTitre, reference) {
  doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(16).text("MUFID ", M, M, { continued: true });
  doc.fillColor(GRIS).text("UNION");
  doc.fillColor(GRIS).font("Helvetica").fontSize(8).text(`RÉFÉRENCE : ${reference}`, M, M + 4, {
    width: W(),
    align: "right",
  });
  doc.moveDown(0.6);
  doc.fillColor(ENCRE).font("Helvetica-Bold").fontSize(17).text(titre, M);
  doc.fillColor(GRIS).font("Helvetica").fontSize(10).text(sousTitre, M);
  const y = doc.y + 6;
  doc.moveTo(M, y).lineTo(M + W(), y).lineWidth(2).strokeColor(BLEU).stroke();
  doc.y = y + 14;
}

// Cartes de synthèse (2 à 4 colonnes).
function synthese(doc, cases) {
  const gap = 10;
  const largeur = (W() - gap * (cases.length - 1)) / cases.length;
  const y0 = doc.y;
  const h = 46;
  cases.forEach((c, i) => {
    const x = M + i * (largeur + gap);
    doc.roundedRect(x, y0, largeur, h, 6).lineWidth(0.8).strokeColor(BORDURE).stroke();
    doc.fillColor("#8A99A1").font("Helvetica").fontSize(8).text(c.label, x + 10, y0 + 9, { width: largeur - 20 });
    doc.fillColor(c.couleur || ENCRE).font("Helvetica-Bold").fontSize(c.petit ? 12 : 16)
      .text(c.valeur, x + 10, y0 + 22, { width: largeur - 20 });
  });
  doc.y = y0 + h + 16;
}

function titreSection(doc, texte) {
  doc.fillColor("#33454F").font("Helvetica-Bold").fontSize(12).text(texte, M);
  doc.moveDown(0.4);
}

// Tableau générique : colonnes = [{ label, largeur, align, key }].
function tableau(doc, colonnes, lignes, options = {}) {
  const { couleurStatutCol } = options;
  const startX = M;
  let y = doc.y;
  const rowH = 20;
  const headerH = 20;

  // En-tête
  doc.rect(startX, y, W(), headerH).fill(BLEU);
  let x = startX;
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8.5);
  for (const c of colonnes) {
    doc.text(c.label, x + 6, y + 6, { width: c.largeur - 12, align: c.align || "left" });
    x += c.largeur;
  }
  y += headerH;

  // Lignes
  doc.font("Helvetica").fontSize(8.5);
  for (let i = 0; i < lignes.length; i++) {
    if (y + rowH > 800) {
      doc.addPage();
      y = M;
    }
    if (i % 2 === 1) doc.rect(startX, y, W(), rowH).fill(GRIS_CLAIR);
    x = startX;
    for (const c of colonnes) {
      const val = String(lignes[i][c.key] ?? "");
      let couleur = "#33454F";
      if (couleurStatutCol && c.key === couleurStatutCol) couleur = couleurStatut(val);
      doc.fillColor(couleur).text(val, x + 6, y + 6, {
        width: c.largeur - 12,
        align: c.align || "left",
        ellipsis: true,
        lineBreak: false,
      });
      x += c.largeur;
    }
    doc.strokeColor(BORDURE).lineWidth(0.4).moveTo(startX, y + rowH).lineTo(startX + W(), y + rowH).stroke();
    y += rowH;
  }
  doc.y = y + 10;
}

function repartitionBarres(doc, titre, items) {
  titreSection(doc, titre);
  const largeurBarre = W() - 200;
  for (const it of items) {
    const y = doc.y;
    doc.fillColor(GRIS).font("Helvetica").fontSize(9).text(it.libelle, M, y, { width: 120 });
    doc.roundedRect(M + 130, y + 1, largeurBarre, 8, 4).fill("#F0F3F4");
    doc.roundedRect(M + 130, y + 1, (largeurBarre * it.pourcentage) / 100, 8, 4).fill(BLEU);
    doc.fillColor("#33454F").font("Helvetica-Bold").fontSize(9)
      .text(`${it.pourcentage}%`, M + 130 + largeurBarre + 8, y, { width: 50 });
    doc.y = y + 16;
  }
  doc.moveDown(0.4);
}

function pied(doc, texte) {
  doc.fillColor("#9AA7AD").font("Helvetica").fontSize(8)
    .text(texte, M, 805, { width: W(), align: "center" });
}

export function rapportIndividuelPdf(rap) {
  return rendre((doc) => {
    entete(doc, "Rapport d'activités individuel",
      `Service Informatique — Période : ${rap.periode}`, rap.reference);

    doc.fillColor(ENCRE).font("Helvetica-Bold").fontSize(13).text(rap.user.nom_complet, M);
    doc.fillColor(GRIS).font("Helvetica").fontSize(10)
      .text(`${rap.user.poste || "—"} · ${rap.user.email}`, M);
    doc.moveDown(0.8);

    synthese(doc, [
      { label: "Activités", valeur: String(rap.nb_activites) },
      { label: "Heures", valeur: fmtH(rap.heures), couleur: BLEU },
      { label: "Complétion", valeur: `${rap.taux_completion} %`, couleur: VERT },
      { label: "Cat. principale", valeur: rap.categorie_principale, petit: true },
    ]);

    repartitionBarres(doc, "Répartition par catégorie", rap.repartition_categorie);
    repartitionBarres(doc, "Statut des activités", rap.repartition_statut);

    titreSection(doc, "Détail des activités");
    tableau(
      doc,
      [
        { label: "Date", key: "date", largeur: 55 },
        { label: "Réf.", key: "reference", largeur: 55 },
        { label: "Activité", key: "titre", largeur: 200 },
        { label: "Catégorie", key: "categorie", largeur: 95 },
        { label: "Statut", key: "statut", largeur: 60 },
        { label: "Durée", key: "dureeTxt", largeur: 50, align: "right" },
      ],
      rap.lignes.map((l) => ({ ...l, dureeTxt: fmtH(l.duree) })),
      { couleurStatutCol: "statut" },
    );

    pied(doc, "Document confidentiel · usage interne · MUFID UNION");
  });
}

// ===========================================================================
// Rapport individuel « hebdomadaire » — calqué sur le modèle métier (paysage).
// ===========================================================================

const ML = 28; // marge du rapport paysage
const LARGEURS_PCT = [13, 18, 22, 15, 10, 22]; // 6 colonnes, somme = 100

function rendrePaysage(construire) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: ML });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    construire(doc);
    doc.end();
  });
}

// Transforme un texte multi-lignes en liste à puces (sauf s'il tient sur 1 ligne).
function texteAffiche(raw) {
  const lignes = String(raw || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lignes.length <= 1) return lignes[0] || "";
  return lignes.map((l) => `• ${l}`).join("\n");
}

const PAD = 5;

// Mesure la hauteur nécessaire d'une ligne du tableau selon le contenu des cellules.
function mesurerLigne(doc, cells, widths, header) {
  const infos = cells.map((c, idx) => {
    const t = header ? c.text : texteAffiche(c.text);
    doc.font(header || c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
    const h = doc.heightOfString(t || " ", { width: widths[idx] - 2 * PAD });
    return { ...c, t, h };
  });
  const rowH = Math.max(header ? 22 : 18, ...infos.map((i) => i.h)) + 2 * PAD;
  return { infos, rowH };
}

// Dessine une ligne mesurée à la position y ; renvoie le y suivant.
function dessinerLigne(doc, infos, rowH, colX, widths, y, header) {
  const totalW = widths.reduce((a, b) => a + b, 0);
  infos.forEach((info, idx) => {
    const x = colX[idx];
    const w = widths[idx];
    const fill = header ? PETROLE_HDR : info.fill;
    if (fill) doc.rect(x, y, w, rowH).fill(fill);
    const color = header ? "#FFFFFF" : info.color || "#33454F";
    doc
      .font(header || info.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8.5)
      .fillColor(color)
      .text(info.t || "", x + PAD, y + PAD, { width: w - 2 * PAD, align: info.align || "left" });
  });
  // Bordures : contour + séparateurs verticaux.
  doc.strokeColor(BORDURE).lineWidth(0.5);
  doc.rect(colX[0], y, totalW, rowH).stroke();
  for (let i = 1; i < colX.length; i++) {
    doc.moveTo(colX[i], y).lineTo(colX[i], y + rowH).stroke();
  }
  return y + rowH;
}

export function rapportHebdoPdf(rap) {
  return rendrePaysage((doc) => {
    const usableW = doc.page.width - 2 * ML;
    const widths = LARGEURS_PCT.map((p) => (usableW * p) / 100);
    const colX = [];
    let acc = ML;
    for (const w of widths) {
      colX.push(acc);
      acc += w;
    }
    const bas = doc.page.height - ML;

    // Bloc-titre centré.
    doc.fillColor(ENCRE).font("Helvetica-Bold").fontSize(17)
      .text("RAPPORT D'ACTIVITÉS", ML, ML, { width: usableW, align: "center" });
    doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(12)
      .text(`Du ${rap.debut_court} au ${rap.fin_court}`, { width: usableW, align: "center" });
    doc.fillColor(GRIS).font("Helvetica").fontSize(10)
      .text(rap.departement, { width: usableW, align: "center" });
    doc.fillColor(ENCRE).font("Helvetica-Bold").fontSize(12)
      .text(rap.user.nom_complet.toUpperCase() + (rap.user.poste ? `  —  ${rap.user.poste}` : ""), {
        width: usableW,
        align: "center",
      });
    doc.moveDown(0.8);

    const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;
    const entetes = [
      { text: "Rubriques" },
      { text: `Activités programmées de la semaine ${periodeCol}` },
      { text: "Description de l'activité" },
      { text: "Résultat obtenu (livrable)" },
      { text: "Statut" },
      { text: "Activités à mener au cours de la semaine suivante" },
    ];
    const dessinerEntete = (y) => {
      const { infos, rowH } = mesurerLigne(doc, entetes, widths, true);
      return dessinerLigne(doc, infos, rowH, colX, widths, y, true);
    };

    let y = dessinerEntete(doc.y);

    if (rap.groupes.length === 0) {
      doc.fillColor(GRIS).font("Helvetica").fontSize(10)
        .text("Aucune activité enregistrée sur cette période.", ML, y + 14, { width: usableW, align: "center" });
    }

    for (const groupe of rap.groupes) {
      groupe.lignes.forEach((l, i) => {
        const cells = [
          { text: i === 0 ? groupe.rubrique : "", fill: PETROLE_CLAIR, bold: true, color: BLEU, align: "center" },
          { text: l.programmee },
          { text: l.etat },
          { text: l.livrable },
          { text: l.statut, align: "center", bold: true, color: couleurStatut(l.statut) },
          { text: l.aMener },
        ];
        const { infos, rowH } = mesurerLigne(doc, cells, widths, false);
        if (y + rowH > bas) {
          doc.addPage();
          y = dessinerEntete(ML);
        }
        y = dessinerLigne(doc, infos, rowH, colX, widths, y, false);
      });
    }

    doc.fillColor(GRIS).font("Helvetica-Oblique").fontSize(8)
      .text(`Référence : ${rap.reference} · Document interne · MUFID UNION`, ML, Math.min(y + 8, bas), {
        width: usableW,
        align: "right",
      });
  });
}

// ---------------------------------------------------------------------------
// Rapport consolidé « hebdomadaire » — même grille + colonne Agent (7 colonnes).
// Fusion visuelle (Agent, Rubriques) obtenue en dessinant les bordures cellule
// par cellule et en omettant le trait supérieur des cellules « continuation ».
// ---------------------------------------------------------------------------

const LARGEURS_CONS_PCT = [12, 12, 16, 19, 13, 9, 19]; // 7 colonnes, somme = 100

// Mesure une ligne du tableau consolidé (les colonnes `multi` passent en puces).
function mesurerLigneCons(doc, cells, widths) {
  const infos = cells.map((c, idx) => {
    const t = c.multi ? texteAffiche(c.text) : c.text || "";
    doc.font(c.bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
    const h = doc.heightOfString(t || " ", { width: widths[idx] - 2 * PAD });
    return { ...c, t, h };
  });
  const rowH = Math.max(18, ...infos.map((i) => i.h)) + 2 * PAD;
  return { infos, rowH };
}

// Dessine une ligne consolidée ; bordures par cellule (topBorder = false ->
// pas de trait haut, effet « cellule fusionnée » sur Agent / Rubriques).
function dessinerLigneCons(doc, infos, rowH, colX, widths, y) {
  infos.forEach((info, idx) => {
    if (info.fill) doc.rect(colX[idx], y, widths[idx], rowH).fill(info.fill);
  });
  infos.forEach((info, idx) => {
    const x = colX[idx];
    const w = widths[idx];
    doc
      .font(info.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8.5)
      .fillColor(info.color || "#33454F")
      .text(info.t || "", x + PAD, y + PAD, { width: w - 2 * PAD, align: info.align || "left" });
  });
  doc.strokeColor(BORDURE).lineWidth(0.5);
  infos.forEach((info, idx) => {
    const x = colX[idx];
    const w = widths[idx];
    doc.moveTo(x, y).lineTo(x, y + rowH).stroke(); // gauche
    doc.moveTo(x + w, y).lineTo(x + w, y + rowH).stroke(); // droite
    doc.moveTo(x, y + rowH).lineTo(x + w, y + rowH).stroke(); // bas
    if (info.topBorder) doc.moveTo(x, y).lineTo(x + w, y).stroke(); // haut si non-continuation
  });
  return y + rowH;
}

export function rapportConsolideHebdoPdf(rap) {
  return rendrePaysage((doc) => {
    const usableW = doc.page.width - 2 * ML;
    const widths = LARGEURS_CONS_PCT.map((p) => (usableW * p) / 100);
    const colX = [];
    let acc = ML;
    for (const w of widths) {
      colX.push(acc);
      acc += w;
    }
    const bas = doc.page.height - ML;

    // Bloc-titre.
    doc.fillColor(ENCRE).font("Helvetica-Bold").fontSize(17)
      .text("RAPPORT D'ACTIVITÉS CONSOLIDÉ", ML, ML, { width: usableW, align: "center" });
    doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(12)
      .text(`Du ${rap.debut_court} au ${rap.fin_court}`, { width: usableW, align: "center" });
    doc.fillColor(GRIS).font("Helvetica").fontSize(10)
      .text(rap.departement, { width: usableW, align: "center" });
    doc.fillColor(ENCRE).font("Helvetica-Bold").fontSize(10)
      .text(`Ensemble du personnel · ${rap.nb_employes} agent(s) · ${rap.nb_activites} activité(s)`, {
        width: usableW,
        align: "center",
      });
    doc.moveDown(0.8);

    const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;
    const entetes = [
      { text: "Agent" },
      { text: "Rubriques" },
      { text: `Activités programmées de la semaine ${periodeCol}` },
      { text: "Description de l'activité" },
      { text: "Résultat obtenu (livrable)" },
      { text: "Statut" },
      { text: "Activités à mener au cours de la semaine suivante" },
    ];
    const dessinerEntete = (yy) => {
      const { infos, rowH } = mesurerLigne(doc, entetes, widths, true);
      return dessinerLigne(doc, infos, rowH, colX, widths, yy, true);
    };

    let y = dessinerEntete(doc.y);

    if (rap.employes.length === 0) {
      doc.fillColor(GRIS).font("Helvetica").fontSize(10)
        .text("Aucune activité enregistrée sur cette période.", ML, y + 14, { width: usableW, align: "center" });
      return;
    }

    for (const emp of rap.employes) {
      const agentTexte = emp.nom_complet.toUpperCase() + (emp.poste ? `\n${emp.poste}` : "");
      let premiereEmp = true;
      for (const groupe of emp.groupes) {
        groupe.lignes.forEach((l, i) => {
          const cells = [
            { text: premiereEmp ? agentTexte : "", fill: PETROLE_TRES_CLAIR, bold: true, color: ENCRE, align: "center", topBorder: premiereEmp },
            { text: i === 0 ? groupe.rubrique : "", fill: PETROLE_CLAIR, bold: true, color: BLEU, align: "center", topBorder: i === 0 },
            { text: l.programmee, topBorder: true },
            { text: l.etat, multi: true, topBorder: true },
            { text: l.livrable, multi: true, topBorder: true },
            { text: l.statut, align: "center", bold: true, color: couleurStatut(l.statut), topBorder: true },
            { text: l.aMener, multi: true, topBorder: true },
          ];
          let mesure = mesurerLigneCons(doc, cells, widths);
          if (y + mesure.rowH > bas) {
            doc.addPage();
            y = dessinerEntete(ML);
            // Réaffiche les libellés Agent/Rubriques en haut de la nouvelle page.
            cells[0].text = agentTexte;
            cells[0].topBorder = true;
            cells[1].text = groupe.rubrique;
            cells[1].topBorder = true;
            mesure = mesurerLigneCons(doc, cells, widths);
          }
          y = dessinerLigneCons(doc, mesure.infos, mesure.rowH, colX, widths, y);
          premiereEmp = false;
        });
      }
    }

    doc.fillColor(GRIS).font("Helvetica-Oblique").fontSize(8)
      .text(`Référence : ${rap.reference} · Document interne · MUFID UNION`, ML, Math.min(y + 8, bas), {
        width: usableW,
        align: "right",
      });
  });
}

export function rapportConsolidePdf(rap) {
  return rendre((doc) => {
    entete(doc, "Rapport d'activités consolidé",
      `Service Informatique — Période : ${rap.periode}`, rap.reference);

    synthese(doc, [
      { label: "Activités", valeur: String(rap.nb_activites) },
      { label: "Employés", valeur: String(rap.nb_employes) },
      { label: "Heures cumulées", valeur: fmtH(rap.heures), couleur: BLEU },
      { label: "Complétion", valeur: `${rap.taux_completion} %`, couleur: VERT },
    ]);

    repartitionBarres(doc, "Répartition par catégorie", rap.repartition_categorie);
    repartitionBarres(doc, "Répartition par statut", rap.repartition_statut);

    titreSection(doc, "Synthèse par employé");
    const lignes = rap.par_employe.map((b) => ({
      nom_complet: b.nom_complet,
      poste: b.poste || "—",
      nb: String(b.nb_activites),
      heures: fmtH(b.heures),
      comp: `${b.taux_completion} %`,
    }));
    lignes.push({
      nom_complet: "TOTAL",
      poste: "",
      nb: String(rap.nb_activites),
      heures: fmtH(rap.heures),
      comp: `${rap.taux_completion} %`,
    });
    tableau(doc, [
      { label: "Employé", key: "nom_complet", largeur: 130 },
      { label: "Poste", key: "poste", largeur: 155 },
      { label: "Activités", key: "nb", largeur: 70, align: "right" },
      { label: "Heures", key: "heures", largeur: 70, align: "right" },
      { label: "Complétion", key: "comp", largeur: 90, align: "right" },
    ], lignes);

    pied(doc, "Document consolidé · MUFID UNION · Zone CEMAC · Régulé COBAC");
  });
}
