// Export des statistiques de la plateforme : Excel (multi-feuilles) et PDF.
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const BLEU_FONCE = "FF093646";
const BLANC = "FFFFFFFF";
const ENCRE = "FF16262E";
const GRIS = "FF5E717B";
const ZEBRA = "FFF4F6F7";
const BORD_XL = { style: "thin", color: { argb: "FFC6D2D7" } };
const BORDS_XL = { top: BORD_XL, left: BORD_XL, bottom: BORD_XL, right: BORD_XL };

const fmtDuree = (min) => {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
};

// ===========================================================================
// EXCEL
// ===========================================================================
function feuilleEntete(ws, titre, sousTitre, nbCols) {
  ws.mergeCells(1, 1, 1, nbCols);
  const c1 = ws.getCell(1, 1);
  c1.value = titre;
  c1.font = { bold: true, size: 14, color: { argb: ENCRE } };

  ws.mergeCells(2, 1, 2, nbCols);
  const c2 = ws.getCell(2, 1);
  c2.value = sousTitre;
  c2.font = { size: 10, color: { argb: GRIS } };
  return 4;
}

function tableauXl(ws, ligne, colonnes, lignes) {
  colonnes.forEach((nom, i) => {
    const c = ws.getCell(ligne, i + 1);
    c.value = nom;
    c.font = { bold: true, color: { argb: BLANC }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLEU_FONCE } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = BORDS_XL;
  });
  ws.getRow(ligne).height = 24;
  let r = ligne + 1;
  lignes.forEach((vals, idx) => {
    vals.forEach((v, i) => {
      const c = ws.getCell(r, i + 1);
      c.value = v;
      c.font = { size: 10, color: { argb: ENCRE } };
      c.border = BORDS_XL;
      c.alignment = { vertical: "top", wrapText: typeof v === "string" && v.length > 30 };
      if (idx % 2 === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
    r += 1;
  });
  return r;
}

export async function statistiquesExcel(st) {
  const wb = new ExcelJS.Workbook();
  const periode = `Période : ${st.debut_court} — ${st.fin_court}  ·  Émis le ${new Date().toLocaleDateString("fr-FR")}`;
  const s = st.synthese;

  // --- Feuille 1 : Synthèse
  const ws = wb.addWorksheet("Synthèse");
  let r = feuilleEntete(ws, "MUFID UNION — Statistiques de la plateforme", periode, 2);
  r = tableauXl(ws, r, ["Indicateur", "Valeur"], [
    ["Total activités", s.total_activites],
    ["Agents concernés", s.nb_agents],
    ["Clôturées (validées)", s.cloturees],
    ["Terminées (non clôturées)", s.terminees],
    ["En cours", s.en_cours],
    ["Standby", s.standby],
    ["À faire", s.a_faire],
    ["En retard", s.en_retard],
    ["Taux de clôture", `${s.taux_cloture} %`],
    ["Taux de retard", `${s.taux_retard} %`],
    ["Charge totale", fmtDuree(s.minutes_total)],
    ["Heures réalisées (clôturées)", fmtDuree(s.minutes_realisees)],
    ["Points cumulés", s.points_total],
    ["Durée moyenne / activité", fmtDuree(s.duree_moyenne_minutes)],
  ]);
  ws.columns = [{ width: 34 }, { width: 22 }];

  // --- Feuille 2 : Par agent
  const ws2 = wb.addWorksheet("Par agent");
  let r2 = feuilleEntete(ws2, "Performance par agent", periode, 8);
  r2 = tableauXl(
    ws2,
    r2,
    ["Agent", "Poste", "Activités", "Clôturées", "En retard", "Charge", "Heures réalisées", "Points"],
    st.par_agent.map((a) => [
      a.nom_complet, a.poste || "—", a.total, a.cloturees, a.en_retard,
      fmtDuree(a.minutes), fmtDuree(a.minutes_realisees), a.points,
    ]),
  );
  ws2.columns = [{ width: 26 }, { width: 24 }, { width: 11 }, { width: 11 }, { width: 11 }, { width: 14 }, { width: 16 }, { width: 10 }];

  // --- Feuille 3 : Activités en retard
  const ws3 = wb.addWorksheet("En retard");
  let r3 = feuilleEntete(ws3, `Activités en retard (${st.activites_en_retard.length})`, periode, 8);
  r3 = tableauXl(
    ws3,
    r3,
    ["Réf.", "Activité", "Agent", "Catégorie", "Priorité", "Statut", "Échéance", "Jours de retard"],
    st.activites_en_retard.map((a) => [
      a.reference, a.titre, a.agent, a.categorie, a.priorite, a.statut, a.echeance, a.jours_retard,
    ]),
  );
  ws3.columns = [{ width: 10 }, { width: 40 }, { width: 22 }, { width: 24 }, { width: 12 }, { width: 12 }, { width: 13 }, { width: 15 }];

  // --- Feuille 4 : Répartitions
  const ws4 = wb.addWorksheet("Répartitions");
  let r4 = feuilleEntete(ws4, "Répartitions", periode, 5);
  ws4.getCell(r4, 1).value = "Par catégorie";
  ws4.getCell(r4, 1).font = { bold: true, size: 11, color: { argb: ENCRE } };
  r4 = tableauXl(ws4, r4 + 1, ["Catégorie", "Activités", "%", "Charge", "Points"],
    st.repartition_categorie.map((x) => [x.libelle, x.total, `${x.pourcentage} %`, fmtDuree(x.minutes), x.points]));
  r4 += 1;
  ws4.getCell(r4, 1).value = "Par statut";
  ws4.getCell(r4, 1).font = { bold: true, size: 11, color: { argb: ENCRE } };
  r4 = tableauXl(ws4, r4 + 1, ["Statut", "Activités", "%", "Charge", "Points"],
    st.repartition_statut.map((x) => [x.libelle, x.total, `${x.pourcentage} %`, fmtDuree(x.minutes), x.points]));
  r4 += 1;
  ws4.getCell(r4, 1).value = "Par priorité";
  ws4.getCell(r4, 1).font = { bold: true, size: 11, color: { argb: ENCRE } };
  r4 = tableauXl(ws4, r4 + 1, ["Priorité", "Activités", "%", "Charge", "Points"],
    st.repartition_priorite.map((x) => [x.libelle, x.total, `${x.pourcentage} %`, fmtDuree(x.minutes), x.points]));
  ws4.columns = [{ width: 26 }, { width: 12 }, { width: 10 }, { width: 14 }, { width: 10 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ===========================================================================
// PDF — format PAYSAGE, hauteurs de ligne calculées d'après le contenu.
// Aucun texte ne peut chevaucher : chaque cellule est mesurée, la ligne prend
// la hauteur du contenu le plus long, et une ligne ne se coupe jamais en deux
// (saut de page propre avec réaffichage de l'en-tête).
// ===========================================================================
const BLEU = "#0E5E7C";
const PETROLE_HDR = "#093646";
const ENCRE_PDF = "#16262E";
const GRIS_PDF = "#5E717B";
const BORDURE = "#C6D2D7";
const ZEBRA_PDF = "#F7F9FA";
const M = 30; // marge
const PAD = 6; // marge intérieure des cellules
const POLICE = 8.5;

/** Mesure une ligne : renvoie les cellules et la hauteur nécessaire. */
function mesurer(doc, cells, largeurs, gras) {
  const infos = cells.map((c, i) => {
    const t = c && typeof c === "object" ? c : { texte: String(c ?? "") };
    doc.font(gras || t.gras ? "Helvetica-Bold" : "Helvetica").fontSize(POLICE);
    const h = doc.heightOfString(t.texte || " ", { width: largeurs[i] - 2 * PAD, align: t.align || "left" });
    return { ...t, h };
  });
  const hauteur = Math.max(gras ? 14 : 12, ...infos.map((i) => i.h)) + 2 * PAD;
  return { infos, hauteur };
}

/** Dessine une ligne mesurée. Renvoie le y suivant. */
function dessiner(doc, infos, hauteur, colX, largeurs, y, { entete = false, zebra = false } = {}) {
  const total = largeurs.reduce((a, b) => a + b, 0);
  if (entete) doc.rect(colX[0], y, total, hauteur).fill(PETROLE_HDR);
  else if (zebra) doc.rect(colX[0], y, total, hauteur).fill(ZEBRA_PDF);

  infos.forEach((info, i) => {
    doc
      .font(entete || info.gras ? "Helvetica-Bold" : "Helvetica")
      .fontSize(POLICE)
      .fillColor(entete ? "#FFFFFF" : info.couleur || "#33454F")
      // Pas de lineBreak:false : le texte long passe à la ligne au lieu de déborder.
      .text(info.texte || "", colX[i] + PAD, y + PAD, {
        width: largeurs[i] - 2 * PAD,
        align: info.align || "left",
      });
  });

  // Bordures : contour + séparateurs verticaux.
  doc.strokeColor(BORDURE).lineWidth(0.5);
  doc.rect(colX[0], y, total, hauteur).stroke();
  for (let i = 1; i < colX.length; i++) {
    doc.moveTo(colX[i], y).lineTo(colX[i], y + hauteur).stroke();
  }
  return y + hauteur;
}

export function statistiquesPdf(st) {
  return new Promise((resolve, reject) => {
    // Paysage : indispensable pour que « Activités en retard » (7 colonnes,
    // intitulés longs) tienne proprement sans chevauchement.
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: M, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 2 * M;
    const BAS = doc.page.height - M - 18; // on réserve la place du pied de page
    const s = st.synthese;

    // ---- Bloc-titre -----------------------------------------------------
    doc.fillColor(ENCRE_PDF).font("Helvetica-Bold").fontSize(16)
      .text("STATISTIQUES DE LA PLATEFORME", M, M, { width: W, align: "center" });
    doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(11)
      .text(`Du ${st.debut_court} au ${st.fin_court}`, { width: W, align: "center" });
    doc.fillColor(GRIS_PDF).font("Helvetica").fontSize(9)
      .text(`MUFID UNION — ${st.departement || "Direction des Systèmes d'Information"}`, {
        width: W,
        align: "center",
      });
    doc.moveDown(0.9);

    // ---- Cartes de synthèse (3 x 3) -------------------------------------
    const cartes = [
      ["Total activités", String(s.total_activites), ENCRE_PDF],
      ["Clôturées", `${s.cloturees} (${s.taux_cloture} %)`, "#1B8A4B"],
      ["En retard", `${s.en_retard} (${s.taux_retard} %)`, "#C0392B"],
      ["Charge totale", fmtDuree(s.minutes_total), BLEU],
      ["Heures réalisées", fmtDuree(s.minutes_realisees), BLEU],
      ["Points cumulés", String(s.points_total), "#B4750E"],
      ["Agents", String(s.nb_agents), ENCRE_PDF],
      ["Durée moyenne", fmtDuree(s.duree_moyenne_minutes), ENCRE_PDF],
      ["En cours / Standby", `${s.en_cours} / ${s.standby}`, GRIS_PDF],
    ];
    const ecart = 10;
    const lc = (W - 2 * ecart) / 3;
    const y0 = doc.y;
    cartes.forEach((c, i) => {
      const x = M + (i % 3) * (lc + ecart);
      const y = y0 + Math.floor(i / 3) * 46;
      doc.roundedRect(x, y, lc, 40, 5).lineWidth(0.8).strokeColor(BORDURE).stroke();
      doc.fillColor("#8A99A1").font("Helvetica").fontSize(7.5).text(c[0], x + 9, y + 8, { width: lc - 18 });
      doc.fillColor(c[2]).font("Helvetica-Bold").fontSize(13).text(c[1], x + 9, y + 20, { width: lc - 18 });
    });
    doc.y = y0 + 3 * 46 + 10;

    // ---- Générateur de tableau ------------------------------------------
    const tableau = (titre, colonnes, fractions, lignes) => {
      const largeurs = fractions.map((f) => W * f);
      const colX = [];
      let acc = M;
      for (const l of largeurs) {
        colX.push(acc);
        acc += l;
      }
      const enteteCells = colonnes.map((t, i) => ({ texte: t, align: i === 0 ? "left" : "center" }));

      const dessinerEntete = (y) => {
        const m = mesurer(doc, enteteCells, largeurs, true);
        return dessiner(doc, m.infos, m.hauteur, colX, largeurs, y, { entete: true });
      };

      // Titre de section : on saute de page s'il ne reste pas la place
      // pour le titre + l'en-tête + au moins une ligne.
      if (doc.y + 70 > BAS) {
        doc.addPage();
        doc.y = M;
      }
      doc.fillColor("#33454F").font("Helvetica-Bold").fontSize(11).text(titre, M, doc.y);
      doc.moveDown(0.35);

      let y = dessinerEntete(doc.y);

      lignes.forEach((ligne, idx) => {
        const m = mesurer(doc, ligne, largeurs, false);
        // Une ligne n'est JAMAIS coupée : si elle ne tient pas, page suivante.
        if (y + m.hauteur > BAS) {
          doc.addPage();
          y = dessinerEntete(M);
        }
        y = dessiner(doc, m.infos, m.hauteur, colX, largeurs, y, { zebra: idx % 2 === 1 });
      });

      doc.y = y + 14;
    };

    // ---- Performance par agent ------------------------------------------
    tableau(
      "Performance par agent",
      ["Agent", "Activités", "Clôturées", "En retard", "Charge", "Taux clôture", "Points"],
      [0.28, 0.11, 0.11, 0.11, 0.13, 0.13, 0.13],
      st.par_agent.length
        ? st.par_agent.map((a) => [
            { texte: a.nom_complet, gras: true },
            { texte: String(a.total), align: "center" },
            { texte: String(a.cloturees), align: "center", couleur: "#1B8A4B" },
            { texte: String(a.en_retard), align: "center", couleur: a.en_retard > 0 ? "#C0392B" : "#8A99A1" },
            { texte: fmtDuree(a.minutes), align: "center" },
            { texte: `${a.taux_cloture} %`, align: "center" },
            { texte: String(a.points), align: "center", gras: true },
          ])
        : [[{ texte: "Aucune activité sur la période.", couleur: GRIS_PDF }, "", "", "", "", "", ""]],
    );

    // ---- Répartition par catégorie ---------------------------------------
    tableau(
      "Répartition par catégorie",
      ["Catégorie", "Activités", "%", "Charge", "Points"],
      [0.4, 0.15, 0.15, 0.15, 0.15],
      st.repartition_categorie.length
        ? st.repartition_categorie.map((c) => [
            { texte: c.libelle },
            { texte: String(c.total), align: "center" },
            { texte: `${c.pourcentage} %`, align: "center" },
            { texte: fmtDuree(c.minutes), align: "center" },
            { texte: String(c.points), align: "center" },
          ])
        : [[{ texte: "Aucune donnée.", couleur: GRIS_PDF }, "", "", "", ""]],
    );

    // ---- Activités en retard (le tableau qui posait problème) -------------
    tableau(
      `Activités en retard (${st.activites_en_retard.length})`,
      ["Activité", "Agent", "Catégorie", "Priorité", "Statut", "Échéance", "Retard"],
      [0.29, 0.15, 0.17, 0.1, 0.1, 0.1, 0.09],
      st.activites_en_retard.length
        ? st.activites_en_retard.map((a) => [
            { texte: a.titre, gras: true },
            { texte: a.agent },
            { texte: a.categorie },
            { texte: a.priorite, align: "center" },
            { texte: a.statut, align: "center" },
            { texte: a.echeance, align: "center" },
            { texte: `${a.jours_retard} j`, align: "center", gras: true, couleur: "#C0392B" },
          ])
        : [
            [
              { texte: "Aucune activité en retard sur cette période.", couleur: "#1B8A4B" },
              "", "", "", "", "", "",
            ],
          ],
    );

    // ---- Pied de page sur CHAQUE page (jamais par-dessus le contenu) ------
    // ⚠ pdfkit ajoute automatiquement une page si un texte dépasse la marge
    // basse. On neutralise donc cette marge le temps d'écrire le pied de page,
    // sans quoi chaque pied de page créerait une page vide supplémentaire.
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      const margeBasse = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor("#9AA7AD").font("Helvetica-Oblique").fontSize(7.5)
        .text(
          `Document interne · MUFID UNION · Zone CEMAC · Régulé COBAC          Page ${i + 1} / ${pages.count}`,
          M,
          doc.page.height - 20,
          { width: W, align: "center", lineBreak: false },
        );
      doc.page.margins.bottom = margeBasse;
    }

    doc.flushPages();
    doc.end();
  });
}

