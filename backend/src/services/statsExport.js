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
// PDF
// ===========================================================================
const BLEU = "#0E5E7C";
const PETROLE_HDR = "#093646";
const ENCRE_PDF = "#16262E";
const GRIS_PDF = "#5E717B";
const BORDURE = "#C6D2D7";
const M = 32;

export function statistiquesPdf(st) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: M });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 2 * M;
    const bas = doc.page.height - M;
    const s = st.synthese;

    // En-tête
    doc.fillColor(ENCRE_PDF).font("Helvetica-Bold").fontSize(16)
      .text("STATISTIQUES DE LA PLATEFORME", M, M, { width: W, align: "center" });
    doc.fillColor(BLEU).font("Helvetica-Bold").fontSize(11)
      .text(`Du ${st.debut_court} au ${st.fin_court}`, { width: W, align: "center" });
    doc.fillColor(GRIS_PDF).font("Helvetica").fontSize(9)
      .text("MUFID UNION — Département de l'Exploitation Informatique", { width: W, align: "center" });
    doc.moveDown(1);

    // Cartes de synthèse (3 x 3)
    const cases = [
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
    const cw = (W - 2 * 8) / 3;
    let y = doc.y;
    cases.forEach((c, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = M + col * (cw + 8);
      const yy = y + row * 46;
      doc.roundedRect(x, yy, cw, 40, 5).lineWidth(0.8).strokeColor(BORDURE).stroke();
      doc.fillColor("#8A99A1").font("Helvetica").fontSize(7.5).text(c[0], x + 8, yy + 7, { width: cw - 16 });
      doc.fillColor(c[2]).font("Helvetica-Bold").fontSize(13).text(c[1], x + 8, yy + 19, { width: cw - 16 });
    });
    doc.y = y + 3 * 46 + 8;

    // Tableau générique
    const tableau = (titre, colonnes, largeurs, lignes) => {
      if (doc.y + 60 > bas) { doc.addPage(); doc.y = M; }
      doc.fillColor("#33454F").font("Helvetica-Bold").fontSize(11).text(titre, M, doc.y);
      doc.moveDown(0.35);
      let yy = doc.y;
      const colX = [];
      let acc = M;
      for (const w of largeurs) { colX.push(acc); acc += w; }

      // En-tête
      doc.rect(M, yy, W, 18).fill(PETROLE_HDR);
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
      colonnes.forEach((c, i) => doc.text(c, colX[i] + 4, yy + 5, { width: largeurs[i] - 8, align: i === 0 ? "left" : "center" }));
      yy += 18;

      doc.font("Helvetica").fontSize(8);
      lignes.forEach((l, idx) => {
        if (yy + 16 > bas) {
          doc.addPage(); yy = M;
          doc.rect(M, yy, W, 18).fill(PETROLE_HDR);
          doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(8);
          colonnes.forEach((c, i) => doc.text(c, colX[i] + 4, yy + 5, { width: largeurs[i] - 8, align: i === 0 ? "left" : "center" }));
          yy += 18;
          doc.font("Helvetica").fontSize(8);
        }
        if (idx % 2 === 1) doc.rect(M, yy, W, 16).fill("#F4F6F7");
        l.forEach((v, i) => {
          doc.fillColor("#33454F").text(String(v), colX[i] + 4, yy + 4, {
            width: largeurs[i] - 8, align: i === 0 ? "left" : "center", ellipsis: true, lineBreak: false,
          });
        });
        doc.strokeColor(BORDURE).lineWidth(0.4).moveTo(M, yy + 16).lineTo(M + W, yy + 16).stroke();
        yy += 16;
      });
      doc.y = yy + 12;
    };

    tableau(
      "Performance par agent",
      ["Agent", "Activités", "Clôturées", "En retard", "Charge", "Points"],
      [W - 5 * 62, 62, 62, 62, 62, 62],
      st.par_agent.map((a) => [a.nom_complet, a.total, a.cloturees, a.en_retard, fmtDuree(a.minutes), a.points]),
    );

    tableau(
      "Répartition par catégorie",
      ["Catégorie", "Activités", "%", "Charge", "Points"],
      [W - 4 * 70, 70, 70, 70, 70],
      st.repartition_categorie.map((c) => [c.libelle, c.total, `${c.pourcentage} %`, fmtDuree(c.minutes), c.points]),
    );

    tableau(
      `Activités en retard (${st.activites_en_retard.length})`,
      ["Activité", "Agent", "Catégorie", "Priorité", "Échéance", "Retard"],
      [W - 5 * 74, 74, 74, 74, 74, 74],
      st.activites_en_retard.length
        ? st.activites_en_retard.map((a) => [a.titre, a.agent, a.categorie, a.priorite, a.echeance, `${a.jours_retard} j`])
        : [["Aucune activité en retard sur la période.", "", "", "", "", ""]],
    );

    doc.fillColor("#9AA7AD").font("Helvetica-Oblique").fontSize(7.5)
      .text("Document interne · MUFID UNION · Zone CEMAC · Régulé COBAC", M, Math.min(doc.y + 4, bas), {
        width: W, align: "center",
      });

    doc.end();
  });
}
