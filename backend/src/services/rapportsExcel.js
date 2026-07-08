// Génération des rapports Excel avec exceljs, en-tête MUFID UNION.
import ExcelJS from "exceljs";

const BLEU = "FF0E5E7C";
const BLEU_FONCE = "FF093646";
const BLANC = "FFFFFFFF";

function enteteFeuille(ws, titre, periode, span) {
  ws.mergeCells(1, 1, 1, span);
  const c1 = ws.getCell(1, 1);
  c1.value = "MUFID UNION";
  c1.font = { bold: true, size: 16, color: { argb: BLANC } };
  c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLEU_FONCE } };
  c1.alignment = { vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, span);
  ws.getCell(2, 1).value = titre;
  ws.getCell(2, 1).font = { bold: true, size: 13, color: { argb: "FF16262E" } };

  ws.mergeCells(3, 1, 3, span);
  const d = new Date().toLocaleDateString("fr-FR");
  ws.getCell(3, 1).value = `Période : ${periode}  ·  Émis le ${d}`;
  ws.getCell(3, 1).font = { size: 10, color: { argb: "FF5E717B" } };
  return 5;
}

function enteteTableau(ws, ligne, colonnes) {
  colonnes.forEach((nom, i) => {
    const c = ws.getCell(ligne, i + 1);
    c.value = nom;
    c.font = { bold: true, color: { argb: BLANC }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLEU } };
  });
  return ligne + 1;
}

export async function rapportIndividuelExcel(rap) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rapport individuel");
  let r = enteteFeuille(ws, `Rapport individuel — ${rap.user.nom_complet}`, rap.periode, 6);

  const infos = [
    ["Employé", rap.user.nom_complet],
    ["Poste", rap.user.poste || "—"],
    ["E-mail", rap.user.email],
    ["Total activités", rap.nb_activites],
    ["Heures cumulées", `${rap.heures} h`],
    ["Taux de complétion", `${rap.taux_completion} %`],
    ["Catégorie principale", rap.categorie_principale],
  ];
  for (const [k, v] of infos) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true, color: { argb: "FF5E717B" } };
    ws.getCell(r, 2).value = v;
    r += 1;
  }
  r += 1;

  r = enteteTableau(ws, r, ["Date", "Réf.", "Activité", "Catégorie", "Statut", "Durée (h)"]);
  for (const l of rap.lignes) {
    ws.getRow(r).values = [l.date, l.reference, l.titre, l.categorie, l.statut, l.duree];
    r += 1;
  }
  ws.getCell(r, 5).value = "Total";
  ws.getCell(r, 5).font = { bold: true };
  ws.getCell(r, 6).value = rap.heures;
  ws.getCell(r, 6).font = { bold: true };

  ws.columns = [{ width: 14 }, { width: 14 }, { width: 52 }, { width: 22 }, { width: 14 }, { width: 12 }];
  ws.views = [{ state: "frozen", ySplit: 4 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function rapportConsolideExcel(rap) {
  const wb = new ExcelJS.Workbook();

  // Feuille 1 : synthèse
  const ws = wb.addWorksheet("Synthèse");
  let r = enteteFeuille(ws, "Rapport consolidé — Service IT", rap.periode, 3);
  const infos = [
    ["Total activités", rap.nb_activites],
    ["Employés", rap.nb_employes],
    ["Heures cumulées", `${rap.heures} h`],
    ["Taux de complétion", `${rap.taux_completion} %`],
  ];
  for (const [k, v] of infos) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true, color: { argb: "FF5E717B" } };
    ws.getCell(r, 2).value = v;
    r += 1;
  }
  r += 1;
  ws.getCell(r, 1).value = "Répartition par catégorie";
  ws.getCell(r, 1).font = { bold: true, size: 11 };
  r += 1;
  r = enteteTableau(ws, r, ["Catégorie", "Nombre", "%"]);
  for (const it of rap.repartition_categorie) {
    ws.getRow(r).values = [it.libelle, it.total, `${it.pourcentage} %`];
    r += 1;
  }
  ws.columns = [{ width: 26 }, { width: 14 }, { width: 12 }];

  // Feuille 2 : par employé
  const ws2 = wb.addWorksheet("Par employé");
  let r2 = enteteFeuille(ws2, "Synthèse par employé", rap.periode, 5);
  r2 = enteteTableau(ws2, r2, ["Employé", "Poste", "Activités", "Heures", "Complétion"]);
  for (const b of rap.par_employe) {
    ws2.getRow(r2).values = [b.nom_complet, b.poste || "—", b.nb_activites, b.heures, `${b.taux_completion} %`];
    r2 += 1;
  }
  ws2.getCell(r2, 1).value = "TOTAL";
  ws2.getCell(r2, 1).font = { bold: true };
  ws2.getCell(r2, 3).value = rap.nb_activites;
  ws2.getCell(r2, 3).font = { bold: true };
  ws2.getCell(r2, 4).value = rap.heures;
  ws2.getCell(r2, 4).font = { bold: true };
  ws2.columns = [{ width: 26 }, { width: 30 }, { width: 12 }, { width: 12 }, { width: 14 }];
  ws2.views = [{ state: "frozen", ySplit: 4 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
