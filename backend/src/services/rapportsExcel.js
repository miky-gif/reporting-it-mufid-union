// Génération des rapports Excel (.xlsx) avec exceljs, au format du modèle métier
// (mêmes colonnes que Word/PDF : Rubriques, Activités programmées, Description,
// Résultat attendu, Statut, Activités à mener ; + Agent pour le consolidé).
import ExcelJS from "exceljs";

const BLEU_FONCE = "FF093646";
const PETROLE_CLAIR = "FFE3EDF1";
const PETROLE_TRES_CLAIR = "FFEEF4F6";
const BLANC = "FFFFFFFF";
const ENCRE = "FF16262E";
const GRIS = "FF5E717B";

function couleurStatutArgb(statut) {
  if (statut === "Clôturé") return "FF1B8A4B";
  if (statut === "Terminé") return "FF14708F";
  if (statut === "En cours") return "FF0E5E7C";
  if (statut === "Standby") return "FFD08A21";
  return "FF5E717B"; // À faire / autre
}

const BORDURE = { style: "thin", color: { argb: "FFC6D2D7" } };
const BORDS = { top: BORDURE, left: BORDURE, bottom: BORDURE, right: BORDURE };

function blocTitre(ws, span, sousTitre, ligne, departement) {
  ws.mergeCells(1, 1, 1, span);
  const c1 = ws.getCell(1, 1);
  c1.value = "RAPPORT D'ACTIVITÉS";
  c1.font = { bold: true, size: 15, color: { argb: ENCRE } };
  c1.alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, span);
  const c2 = ws.getCell(2, 1);
  c2.value = sousTitre;
  c2.font = { bold: true, size: 12, color: { argb: "FF0E5E7C" } };
  c2.alignment = { horizontal: "center" };

  ws.mergeCells(3, 1, 3, span);
  const c3 = ws.getCell(3, 1);
  // Département dynamique (Infrastructure, Exploitation Système…).
  c3.value = departement || "Direction des Systèmes d'Information";
  c3.font = { size: 10, color: { argb: GRIS } };
  c3.alignment = { horizontal: "center" };

  ws.mergeCells(4, 1, 4, span);
  const c4 = ws.getCell(4, 1);
  c4.value = ligne;
  c4.font = { bold: true, size: 11, color: { argb: ENCRE } };
  c4.alignment = { horizontal: "center" };
  return 6; // première ligne d'en-tête de tableau
}

function enteteTableau(ws, ligne, colonnes) {
  colonnes.forEach((nom, i) => {
    const c = ws.getCell(ligne, i + 1);
    c.value = nom;
    c.font = { bold: true, color: { argb: BLANC }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLEU_FONCE } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = BORDS;
  });
  ws.getRow(ligne).height = 30;
  return ligne + 1;
}

function ecrireCellule(ws, r, c, valeur, { wrap = false, bold = false, color, fill, align } = {}) {
  const cell = ws.getCell(r, c);
  cell.value = valeur ?? "";
  cell.font = { size: 10, color: { argb: color || ENCRE }, bold };
  cell.alignment = { vertical: "top", wrapText: wrap, horizontal: align || "left" };
  cell.border = BORDS;
  if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  return cell;
}

// Fusionne verticalement la cellule (colonne `col`) de `debut` à `fin` si besoin.
function fusion(ws, col, debut, fin) {
  if (fin > debut) ws.mergeCells(debut, col, fin, col);
}

export async function rapportHebdoExcel(rap) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rapport individuel");
  const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;

  let r = blocTitre(
    ws,
    7,
    `Du ${rap.debut_court} au ${rap.fin_court}`,
    `${rap.user.nom_complet.toUpperCase()}${rap.user.poste ? "  —  " + rap.user.poste : ""}`,
    rap.departement,
  );

  r = enteteTableau(ws, r, [
    "Rubriques",
    `Activités programmées de la semaine ${periodeCol}`,
    "Description de l'activité",
    "Résultat attendu (livrable)",
    "Statut",
    "% réalisation",
    "Activités à mener (semaine suivante)",
  ]);

  for (const g of rap.groupes) {
    const debut = r;
    for (const l of g.lignes) {
      ecrireCellule(ws, r, 1, g.rubrique, { bold: true, color: "FF0E5E7C", align: "center", fill: PETROLE_CLAIR });
      ecrireCellule(ws, r, 2, l.programmee, { wrap: true });
      ecrireCellule(ws, r, 3, l.etat, { wrap: true });
      ecrireCellule(ws, r, 4, l.livrable, { wrap: true });
      ecrireCellule(ws, r, 5, l.statut, { bold: true, align: "center", color: couleurStatutArgb(l.statut) });
      ecrireCellule(ws, r, 6, l.pourcentage, { bold: true, align: "center" });
      ecrireCellule(ws, r, 7, l.aMener, { wrap: true });
      r += 1;
    }
    fusion(ws, 1, debut, r - 1);
  }
  if (rap.groupes.length === 0) {
    ws.mergeCells(r, 1, r, 7);
    ecrireCellule(ws, r, 1, "Aucune activité enregistrée sur cette période.", { align: "center", color: GRIS });
  }

  ws.columns = [{ width: 22 }, { width: 30 }, { width: 38 }, { width: 24 }, { width: 13 }, { width: 12 }, { width: 32 }];
  ws.views = [{ state: "frozen", ySplit: 6 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function rapportConsolideHebdoExcel(rap) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rapport consolidé");
  const periodeCol = `du ${rap.debut_court} au ${rap.fin_court}`;

  let r = blocTitre(
    ws,
    8,
    `Rapport consolidé — Du ${rap.debut_court} au ${rap.fin_court}`,
    `Ensemble du personnel · ${rap.nb_employes} agent(s) · ${rap.nb_activites} activité(s)`,
    rap.departement,
  );

  r = enteteTableau(ws, r, [
    "Agent",
    "Rubriques",
    `Activités programmées de la semaine ${periodeCol}`,
    "Description de l'activité",
    "Résultat attendu (livrable)",
    "Statut",
    "% réalisation",
    "Activités à mener (semaine suivante)",
  ]);

  for (const emp of rap.employes) {
    const debutEmp = r;
    for (const g of emp.groupes) {
      const debutCat = r;
      for (const l of g.lignes) {
        ecrireCellule(ws, r, 1, "", { fill: PETROLE_TRES_CLAIR });
        ecrireCellule(ws, r, 2, g.rubrique, { bold: true, color: "FF0E5E7C", align: "center", fill: PETROLE_CLAIR });
        ecrireCellule(ws, r, 3, l.programmee, { wrap: true });
        ecrireCellule(ws, r, 4, l.etat, { wrap: true });
        ecrireCellule(ws, r, 5, l.livrable, { wrap: true });
        ecrireCellule(ws, r, 6, l.statut, { bold: true, align: "center", color: couleurStatutArgb(l.statut) });
        ecrireCellule(ws, r, 7, l.pourcentage, { bold: true, align: "center" });
        ecrireCellule(ws, r, 8, l.aMener, { wrap: true });
        r += 1;
      }
      fusion(ws, 2, debutCat, r - 1);
    }
    // Colonne Agent : nom (+ poste) fusionné sur tout le bloc de l'agent.
    const cellAgent = ecrireCellule(
      ws,
      debutEmp,
      1,
      emp.nom_complet.toUpperCase() + (emp.poste ? `\n${emp.poste}` : ""),
      { bold: true, align: "center", color: ENCRE, fill: PETROLE_TRES_CLAIR, wrap: true },
    );
    cellAgent.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    fusion(ws, 1, debutEmp, r - 1);
  }
  if (rap.employes.length === 0) {
    ws.mergeCells(r, 1, r, 8);
    ecrireCellule(ws, r, 1, "Aucune activité enregistrée sur cette période.", { align: "center", color: GRIS });
  }

  ws.columns = [{ width: 22 }, { width: 19 }, { width: 26 }, { width: 32 }, { width: 22 }, { width: 13 }, { width: 12 }, { width: 28 }];
  ws.views = [{ state: "frozen", ySplit: 6 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
