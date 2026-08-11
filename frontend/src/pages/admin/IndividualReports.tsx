import { FileSpreadsheet, FileText, FileType2, Loader2 } from "lucide-react";
import { startOfMonth, subMonths } from "date-fns";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { telechargerFichier } from "@/lib/download";
import { isoDate } from "@/lib/format";
import type { UserWithStats } from "@/types";
import { EnteteSection, Spinner } from "@/components/ui/Divers";

interface LigneRapport {
  programmee: string;
  etat: string;
  livrable: string;
  pourcentage: string;
  statut: string;
}
interface GroupeRapport {
  code: string;
  rubrique: string;
  couleur: string;
  ordre: number;
  lignes: LigneRapport[];
}
interface Apercu {
  user: { id: number; nom_complet: string; poste: string | null; email: string };
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
  groupes: GroupeRapport[];
  groupes_a_mener: GroupeRapport[];
}

export default function IndividualReports() {
  const [employes, setEmployes] = useState<UserWithStats[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [debut, setDebut] = useState(isoDate(startOfMonth(subMonths(new Date(), 1))));
  const [fin, setFin] = useState(isoDate(new Date()));
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [chargement, setChargement] = useState(false);
  const [telechargement, setTelechargement] = useState<"pdf" | "word" | "excel" | null>(null);
  // Par défaut, seul le 1er tableau est exporté ; l'utilisateur peut inclure le 2e.
  const [inclureAMener, setInclureAMener] = useState(false);

  useEffect(() => {
    api.get<UserWithStats[]>("/users").then((r) => {
      setEmployes(r.data);
      if (r.data.length && !userId) setUserId(String(r.data[0].id));
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    setChargement(true);
    api
      .get<Apercu>("/rapports/individuel/apercu", { params: { user_id: userId, date_debut: debut, date_fin: fin } })
      .then((r) => setApercu(r.data))
      .catch(() => setApercu(null))
      .finally(() => setChargement(false));
  }, [userId, debut, fin]);

  async function exporter(format: "pdf" | "word" | "excel") {
    setTelechargement(format);
    try {
      await telechargerFichier("/rapports/individuel", {
        user_id: userId,
        date_debut: debut,
        date_fin: fin,
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
      <EnteteSection titre="Rapports individuels" sousTitre="Le type (hebdomadaire, mensuel, annuel) est détecté d'après la période." />

      {/* Barre de configuration */}
      <div className="carte mb-5 flex flex-wrap items-end gap-4 p-[16px_18px]">
        <div className="min-w-[220px] flex-1">
          <label className="label">Employé</label>
          <select className="champ" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {employes.map((e) => (
              <option key={e.id} value={e.id}>{e.nom_complet} — {e.poste}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Du</label>
          <input type="date" className="champ font-mono" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div>
          <label className="label">Au</label>
          <input type="date" className="champ font-mono" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
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
          {/* En-tête calqué sur le modèle, avec le type détecté */}
          <div className="mb-6 text-center">
            <div className="text-xl font-bold tracking-tight text-encre">
              RAPPORT D'ACTIVITÉS {apercu.type_label}
            </div>
            <div className="mt-1 text-[15px] font-semibold text-petrole-600">Du {apercu.debut_court} au {apercu.fin_court}</div>
            <div className="mt-0.5 text-[13px] text-gris">{apercu.departement}</div>
            <div className="mt-2 text-[15px] font-semibold uppercase text-encre">
              {apercu.user.nom_complet}
              {apercu.user.poste && <span className="ml-2 text-[13px] font-normal normal-case text-gris">— {apercu.user.poste}</span>}
            </div>
          </div>

          {/* Tableau 1 : activités de la période */}
          <div className="mb-2 text-[13.5px] font-semibold text-encre">Activités de la période — {periodeCol}</div>
          <TableauRapport groupes={apercu.groupes} periodeCol={periodeCol} />

          {/* Tableau 2 : activités à mener (période suivante) — seulement si demandé */}
          {inclureAMener && (
            <>
              <div className="mb-2 mt-7 text-[13.5px] font-semibold text-petrole-600">
                Activités à mener ({apercu.suivant_label}) — {periodeSuiv}
              </div>
              <TableauRapport groupes={apercu.groupes_a_mener} periodeCol={periodeSuiv} />
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

// Tableau du rapport (6 colonnes), groupé par Rubriques. Réutilisé pour les deux tableaux.
function TableauRapport({ groupes, periodeCol }: { groupes: GroupeRapport[]; periodeCol: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-fixed border-collapse text-[12px]">
        <colgroup>
          <col style={{ width: "14%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "28%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "9%" }} />
          <col style={{ width: "9%" }} />
        </colgroup>
        <thead>
          <tr className="bg-petrole-800 text-left text-white">
            <Th>Rubriques</Th>
            <Th>Activités programmées ({periodeCol})</Th>
            <Th>Description de l'activité</Th>
            <Th>Résultat attendu (livrable)</Th>
            <Th className="text-center">Statut</Th>
            <Th className="text-center">% réal.</Th>
          </tr>
        </thead>
        <tbody>
          {groupes.length === 0 && (
            <tr>
              <td colSpan={6} className="border border-[#D8E1E5] py-6 text-center text-grisdoux">
                Aucune activité sur cette période.
              </td>
            </tr>
          )}
          {groupes.map((g) =>
            g.lignes.map((l, i) => (
              <tr key={g.code + i} className="align-top">
                {i === 0 && (
                  <td
                    rowSpan={g.lignes.length}
                    className="break-words border border-[#D8E1E5] bg-petrole-50 px-2.5 py-2 text-center align-middle font-semibold text-petrole-700"
                  >
                    {g.rubrique}
                  </td>
                )}
                <Td>{l.programmee}</Td>
                <Td><Multiligne texte={l.etat} /></Td>
                <Td><Multiligne texte={l.livrable} /></Td>
                <td className="border border-[#D8E1E5] px-2.5 py-2 text-center font-semibold" style={{ color: couleurStatut(l.statut) }}>{l.statut}</td>
                <td className="border border-[#D8E1E5] px-2.5 py-2 text-center font-semibold text-ardoise">{l.pourcentage}</td>
              </tr>
            )),
          )}
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
