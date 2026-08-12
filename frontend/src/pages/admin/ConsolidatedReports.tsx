import { FileSpreadsheet, FileText, FileType2, Loader2 } from "lucide-react";
import { startOfMonth, subMonths } from "date-fns";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { telechargerFichier } from "@/lib/download";
import { isoDate } from "@/lib/format";
import { EnteteSection, Spinner } from "@/components/ui/Divers";
import type { Departement } from "@/types";

interface LigneRapport {
  programmee: string;
  etat: string;
  livrable: string;
  pourcentage: string;
  statut: string;
  pg_span: number; // rowSpan de la rubrique (0 = fusionnée avec la précédente)
}
interface GroupeRapport {
  code: string;
  rubrique: string;
  couleur: string;
  ordre: number;
  lignes: LigneRapport[];
}
interface EmployeRapport {
  user_id: number;
  nom_complet: string;
  poste: string;
  nb_activites: number;
  groupes: GroupeRapport[];
}
interface Apercu {
  periode: string;
  type_label: string;
  suivant_label: string;
  reference: string;
  departement: string;
  debut_court: string;
  fin_court: string;
  debut_suivant_court: string;
  fin_suivant_court: string;
  nb_activites: number;
  nb_a_mener: number;
  nb_employes: number;
  employes: EmployeRapport[];
  employes_a_mener: EmployeRapport[];
}

export default function ConsolidatedReports() {
  const [debut, setDebut] = useState(isoDate(startOfMonth(subMonths(new Date(), 1))));
  const [fin, setFin] = useState(isoDate(new Date()));
  // "" = tous les départements de mon périmètre ; sinon un département précis.
  const [departementId, setDepartementId] = useState<number | "">("");
  const [deps, setDeps] = useState<Departement[]>([]);
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [chargement, setChargement] = useState(false);
  const [telechargement, setTelechargement] = useState<"pdf" | "word" | "excel" | null>(null);
  // Par défaut, seul le 1er tableau est exporté ; l'utilisateur peut inclure le 2e.
  const [inclureAMener, setInclureAMener] = useState(false);

  // Départements accessibles (l'API ne renvoie que ceux de mon périmètre).
  useEffect(() => {
    api
      .get<Departement[]>("/departements")
      .then((r) => setDeps(r.data.filter((d) => d.actif)))
      .catch(() => setDeps([]));
  }, []);

  // On ne propose le choix du département que si l'on en gère plusieurs.
  const choixDepartement = deps.length > 1;
  const paramsBase = () => ({
    date_debut: debut,
    date_fin: fin,
    ...(departementId ? { departement_id: departementId } : {}),
  });

  useEffect(() => {
    setChargement(true);
    api
      .get<Apercu>("/rapports/consolide/apercu", { params: paramsBase() })
      .then((r) => setApercu(r.data))
      .catch(() => setApercu(null))
      .finally(() => setChargement(false));
  }, [debut, fin, departementId]);

  async function exporter(format: "pdf" | "word" | "excel") {
    setTelechargement(format);
    try {
      await telechargerFichier("/rapports/consolide", {
        ...paramsBase(),
        format,
        inclure_a_mener: inclureAMener ? "1" : undefined,
      });
    } catch (err) {
      alert(messageErreur(err, "Export impossible."));
    } finally {
      setTelechargement(null);
    }
  }

  const periodeCol = apercu ? `du ${apercu.debut_court} au ${apercu.fin_court}` : "";
  const periodeSuiv = apercu ? `du ${apercu.debut_suivant_court} au ${apercu.fin_suivant_court}` : "";

  return (
    <>
      <EnteteSection titre="Rapports consolidés" sousTitre="Ensemble du personnel. Le type (hebdo, mensuel, annuel) est détecté d'après la période." />

      <div className="carte mb-5 flex flex-wrap items-end gap-4 p-[16px_18px]">
        {choixDepartement && (
          <div className="min-w-[220px]">
            <label className="label">Département</label>
            <select
              className="champ"
              value={departementId}
              onChange={(e) => setDepartementId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Tous mes départements</option>
              {deps.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Du</label>
          <input type="date" className="champ font-mono" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div>
          <label className="label">Au</label>
          <input type="date" className="champ font-mono" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
        <div className="flex-1" />
        <div className="flex gap-2.5">
          <button className="btn-primaire" disabled={!!telechargement} onClick={() => exporter("word")}>
            {telechargement === "word" ? <Loader2 size={19} className="animate-spin" /> : <FileType2 size={19} />}
            Word
          </button>
          <button className="btn-succes" disabled={!!telechargement} onClick={() => exporter("excel")}>
            {telechargement === "excel" ? <Loader2 size={19} className="animate-spin" /> : <FileSpreadsheet size={19} />}
            Excel
          </button>
          <button className="btn-danger" disabled={!!telechargement} onClick={() => exporter("pdf")}>
            {telechargement === "pdf" ? <Loader2 size={19} className="animate-spin" /> : <FileText size={19} />}
            PDF
          </button>
        </div>
        <label className="flex w-full items-center gap-2 border-t border-[#EEF2F3] pt-3 text-[13px] text-ardoise">
          <input type="checkbox" className="accent-petrole-600" checked={inclureAMener} onChange={(e) => setInclureAMener(e.target.checked)} />
          Inclure aussi le tableau « Activités à mener » (période suivante) dans l'export
        </label>
      </div>

      <div className="mb-2.5 ml-0.5 font-mono text-[11px] tracking-wide text-grisdoux">APERÇU DU RAPPORT</div>

      {chargement || !apercu ? (
        <Spinner />
      ) : (
        <div className="rounded-md border border-bordure bg-white p-6 shadow-popover sm:p-9">
          {/* En-tête avec le type détecté */}
          <div className="mb-6 text-center">
            <div className="text-xl font-bold tracking-tight text-encre">
              RAPPORT D'ACTIVITÉS {apercu.type_label} — CONSOLIDÉ
            </div>
            <div className="mt-1 text-[15px] font-semibold text-petrole-600">Du {apercu.debut_court} au {apercu.fin_court}</div>
            <div className="mt-0.5 text-[13px] text-gris">{apercu.departement}</div>
            <div className="mt-2 text-[13px] font-semibold text-encre">
              Ensemble du personnel · {apercu.nb_employes} agent(s) · {apercu.nb_activites} activité(s)
            </div>
          </div>

          {/* Tableau 1 : activités de la période */}
          <div className="mb-2 text-[13.5px] font-semibold text-encre">Activités de la période — {periodeCol}</div>
          <TableauConsolide employes={apercu.employes} periodeCol={periodeCol} />

          {/* Tableau 2 : activités à mener (période suivante) — seulement si demandé */}
          {inclureAMener && (
            <>
              <div className="mb-2 mt-7 text-[13.5px] font-semibold text-petrole-600">
                Activités à mener ({apercu.suivant_label}) — {periodeSuiv}
              </div>
              <TableauConsolide employes={apercu.employes_a_mener} periodeCol={periodeSuiv} />
            </>
          )}

          <div className="mt-4 text-right text-[10.5px] italic text-grisdoux">
            Référence : {apercu.reference} · Document interne · MUFID UNION
          </div>
        </div>
      )}
    </>
  );
}

// Tableau consolidé (7 colonnes) : Agent -> Rubriques -> activités. Réutilisé pour les deux tableaux.
function TableauConsolide({ employes, periodeCol }: { employes: EmployeRapport[]; periodeCol: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] table-fixed border-collapse text-[12px]">
        <colgroup>
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "19%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
        </colgroup>
        <thead>
          <tr className="bg-petrole-800 text-left text-white">
            <Th className="text-center">Agent</Th>
            <Th>Rubriques</Th>
            <Th>Activités programmées ({periodeCol})</Th>
            <Th>Description de l'activité</Th>
            <Th>Résultat attendu (livrable)</Th>
            <Th className="text-center">Statut</Th>
            <Th className="text-center">% réal.</Th>
          </tr>
        </thead>
        <tbody>
          {employes.length === 0 && (
            <tr>
              <td colSpan={7} className="border border-[#D8E1E5] py-6 text-center text-grisdoux">
                Aucune activité sur cette période.
              </td>
            </tr>
          )}
          {employes.map((emp) => {
            const totalRows = emp.groupes.reduce((s, g) => s + g.lignes.length, 0);
            return emp.groupes.map((g, gi) =>
              g.lignes.map((l, i) => (
                <tr key={emp.user_id + "-" + g.code + "-" + i} className="align-top">
                  {gi === 0 && i === 0 && (
                    <td
                      rowSpan={totalRows}
                      className="break-words border border-[#D8E1E5] bg-[#EEF4F6] px-2.5 py-2 text-center align-middle"
                    >
                      <div className="font-semibold uppercase text-encre">{emp.nom_complet}</div>
                      {emp.poste && <div className="text-[10.5px] font-normal text-grisdoux">{emp.poste}</div>}
                    </td>
                  )}
                  {i === 0 && (
                    <td
                      rowSpan={g.lignes.length}
                      className="break-words border border-[#D8E1E5] bg-petrole-50 px-2.5 py-2 text-center align-middle font-semibold text-petrole-700"
                    >
                      {g.rubrique}
                    </td>
                  )}
                  {l.pg_span > 0 && (
                    <td rowSpan={l.pg_span} className="break-words border border-[#D8E1E5] px-2.5 py-2 align-middle text-ardoise">
                      {l.programmee}
                    </td>
                  )}
                  <Td><Multiligne texte={l.etat} /></Td>
                  <Td><Multiligne texte={l.livrable} /></Td>
                  <td className="border border-[#D8E1E5] px-2.5 py-2 text-center font-semibold" style={{ color: couleurStatut(l.statut) }}>{l.statut}</td>
                  <td className="border border-[#D8E1E5] px-2.5 py-2 text-center font-semibold text-ardoise">{l.pourcentage}</td>
                </tr>
              )),
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function couleurStatut(statut: string): string {
  if (statut === "Terminé") return "#1B8A4B";
  if (statut === "Clôturé") return "#0B6E39";
  if (statut === "En cours") return "#0E5E7C";
  if (statut === "Standby") return "#D2691E";
  return "#5E717B"; // À faire / autre
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={"border border-[#0B4A61] px-2.5 py-2 text-[11px] font-semibold " + className}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="break-words border border-[#D8E1E5] px-2.5 py-2 align-top text-ardoise">{children}</td>;
}

function Multiligne({ texte }: { texte: string }) {
  const lignes = (texte || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lignes.length === 0) return <span className="text-grisdoux">—</span>;
  if (lignes.length === 1) return <span>{lignes[0]}</span>;
  return (
    <ul className="ml-3.5 list-disc space-y-0.5">
      {lignes.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}
