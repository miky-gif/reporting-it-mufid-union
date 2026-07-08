import { FileText, FileType2, Loader2 } from "lucide-react";
import { startOfMonth, subMonths } from "date-fns";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { telechargerFichier } from "@/lib/download";
import { isoDate } from "@/lib/format";
import { EnteteSection, Spinner } from "@/components/ui/Divers";

interface LigneRapport {
  programmee: string;
  etat: string;
  livrable: string;
  pourcentage: string;
  statut: string;
  aMener: string;
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
  reference: string;
  departement: string;
  debut_court: string;
  fin_court: string;
  nb_activites: number;
  nb_employes: number;
  employes: EmployeRapport[];
}

export default function ConsolidatedReports() {
  const [debut, setDebut] = useState(isoDate(startOfMonth(subMonths(new Date(), 1))));
  const [fin, setFin] = useState(isoDate(new Date()));
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [chargement, setChargement] = useState(false);
  const [telechargement, setTelechargement] = useState<"pdf" | "word" | null>(null);

  useEffect(() => {
    setChargement(true);
    api
      .get<Apercu>("/rapports/consolide/apercu", { params: { date_debut: debut, date_fin: fin } })
      .then((r) => setApercu(r.data))
      .catch(() => setApercu(null))
      .finally(() => setChargement(false));
  }, [debut, fin]);

  async function exporter(format: "pdf" | "word") {
    setTelechargement(format);
    try {
      await telechargerFichier("/rapports/consolide", { date_debut: debut, date_fin: fin, format });
    } catch (err) {
      alert(messageErreur(err, "Export impossible."));
    } finally {
      setTelechargement(null);
    }
  }

  const periodeCol = apercu ? `du ${apercu.debut_court} au ${apercu.fin_court}` : "";

  return (
    <>
      <EnteteSection titre="Rapports consolidés" sousTitre="Rapport de l'ensemble du personnel IT, au format du modèle métier." />

      <div className="carte mb-5 flex flex-wrap items-end gap-4 p-[16px_18px]">
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
            Télécharger Word
          </button>
          <button className="btn-danger" disabled={!!telechargement} onClick={() => exporter("pdf")}>
            {telechargement === "pdf" ? <Loader2 size={19} className="animate-spin" /> : <FileText size={19} />}
            Télécharger PDF
          </button>
        </div>
      </div>

      <div className="mb-2.5 ml-0.5 font-mono text-[11px] tracking-wide text-grisdoux">APERÇU DU RAPPORT</div>

      {chargement || !apercu ? (
        <Spinner />
      ) : (
        <div className="rounded-md border border-bordure bg-white p-6 shadow-popover sm:p-9">
          {/* En-tête */}
          <div className="mb-6 text-center">
            <div className="text-xl font-bold tracking-tight text-encre">RAPPORT D'ACTIVITÉS CONSOLIDÉ</div>
            <div className="mt-1 text-[15px] font-semibold text-petrole-600">Du {apercu.debut_court} au {apercu.fin_court}</div>
            <div className="mt-0.5 text-[13px] text-gris">{apercu.departement}</div>
            <div className="mt-2 text-[13px] font-semibold text-encre">
              Ensemble du personnel · {apercu.nb_employes} agent(s) · {apercu.nb_activites} activité(s)
            </div>
          </div>

          {/* Tableau consolidé : Agent -> Rubriques -> activités */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-[12px]">
              <thead>
                <tr className="bg-petrole-800 text-left text-white">
                  <Th className="text-center">Agent</Th>
                  <Th>Rubriques</Th>
                  <Th>Activités programmées {periodeCol}</Th>
                  <Th>Description de l'activité</Th>
                  <Th>Résultat obtenu (livrable)</Th>
                  <Th className="text-center">Statut</Th>
                  <Th>Activités à mener (semaine suivante)</Th>
                </tr>
              </thead>
              <tbody>
                {apercu.employes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="border border-[#D8E1E5] py-8 text-center text-grisdoux">
                      Aucune activité enregistrée sur cette période.
                    </td>
                  </tr>
                )}
                {apercu.employes.map((emp) => {
                  const totalRows = emp.groupes.reduce((s, g) => s + g.lignes.length, 0);
                  return emp.groupes.map((g, gi) =>
                    g.lignes.map((l, i) => (
                      <tr key={emp.user_id + "-" + g.code + "-" + i} className="align-top">
                        {gi === 0 && i === 0 && (
                          <td
                            rowSpan={totalRows}
                            className="border border-[#D8E1E5] bg-[#EEF4F6] px-2.5 py-2 text-center align-middle"
                          >
                            <div className="font-semibold uppercase text-encre">{emp.nom_complet}</div>
                            {emp.poste && <div className="text-[10.5px] font-normal text-grisdoux">{emp.poste}</div>}
                          </td>
                        )}
                        {i === 0 && (
                          <td
                            rowSpan={g.lignes.length}
                            className="border border-[#D8E1E5] bg-petrole-50 px-2.5 py-2 text-center align-middle font-semibold text-petrole-700"
                          >
                            {g.rubrique}
                          </td>
                        )}
                        <Td>{l.programmee}</Td>
                        <Td><Multiligne texte={l.etat} /></Td>
                        <Td><Multiligne texte={l.livrable} /></Td>
                        <td className="border border-[#D8E1E5] px-2.5 py-2 text-center font-semibold" style={{ color: couleurStatut(l.statut) }}>{l.statut}</td>
                        <Td><Multiligne texte={l.aMener} /></Td>
                      </tr>
                    )),
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 text-right text-[10.5px] italic text-grisdoux">
            Référence : {apercu.reference} · Document interne · MUFID UNION
          </div>
        </div>
      )}
    </>
  );
}

function couleurStatut(statut: string): string {
  if (statut === "Terminé") return "#1B8A4B";
  if (statut === "En cours") return "#0E5E7C";
  if (statut === "Bloqué") return "#C0392B";
  return "#5E717B"; // À faire / autre
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={"border border-[#0B4A61] px-2.5 py-2 text-[11px] font-semibold " + className}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="border border-[#D8E1E5] px-2.5 py-2 text-ardoise">{children}</td>;
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
