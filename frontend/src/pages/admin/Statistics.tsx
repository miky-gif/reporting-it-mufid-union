import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Gauge,
  LayoutList,
  Loader2,
  Users,
} from "lucide-react";
import { startOfMonth, subMonths } from "date-fns";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, messageErreur } from "@/lib/api";
import { telechargerFichier } from "@/lib/download";
import { formatDuree, formatPoints, isoDate } from "@/lib/format";
import { PRIORITES, STATUTS } from "@/lib/constants";
import type { AgentStat, RepartitionStat, StatsAvancees } from "@/types";
import { KpiCard } from "@/components/ui/KpiCard";
import { Avatar } from "@/components/ui/Avatar";
import { EnteteSection, Spinner } from "@/components/ui/Divers";

export default function Statistics() {
  const [debut, setDebut] = useState(isoDate(startOfMonth(subMonths(new Date(), 2))));
  const [fin, setFin] = useState(isoDate(new Date()));
  const [st, setSt] = useState<StatsAvancees | null>(null);
  const [chargement, setChargement] = useState(true);
  const [tele, setTele] = useState<"excel" | "pdf" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setChargement(true);
    api
      .get<StatsAvancees>("/stats/avancees", { params: { date_debut: debut, date_fin: fin } })
      .then((r) => setSt(r.data))
      .catch(() => setSt(null))
      .finally(() => setChargement(false));
  }, [debut, fin]);

  async function exporter(format: "excel" | "pdf") {
    setErreur(null);
    setTele(format);
    try {
      await telechargerFichier("/stats/export", { date_debut: debut, date_fin: fin, format });
    } catch (err) {
      setErreur(messageErreur(err, "Export impossible."));
    } finally {
      setTele(null);
    }
  }

  return (
    <>
      <EnteteSection
        titre="Statistiques"
        sousTitre="Analyse détaillée de l'activité de la plateforme, exportable."
      />

      {/* Barre : période + exports */}
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
          <button className="btn-succes" disabled={!!tele || !st} onClick={() => exporter("excel")}>
            {tele === "excel" ? <Loader2 size={19} className="animate-spin" /> : <FileSpreadsheet size={19} />}
            Exporter Excel
          </button>
          <button className="btn-danger" disabled={!!tele || !st} onClick={() => exporter("pdf")}>
            {tele === "pdf" ? <Loader2 size={19} className="animate-spin" /> : <FileText size={19} />}
            Exporter PDF
          </button>
        </div>
      </div>

      {erreur && (
        <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">{erreur}</div>
      )}

      {chargement || !st ? (
        <Spinner />
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              titre="Total activités"
              valeur={st.synthese.total_activites}
              icone={LayoutList}
              bas={`${st.synthese.nb_agents} agent(s) · durée moy. ${formatDuree(st.synthese.duree_moyenne_minutes)}`}
            />
            <KpiCard
              titre="Clôturées (validées)"
              valeur={st.synthese.cloturees}
              icone={CheckCircle2}
              couleurIcone="#1B8A4B"
              fondIcone="#E4F5EB"
              valeurCouleur="#1B8A4B"
              bas={`taux de clôture : ${st.synthese.taux_cloture} %`}
            />
            <KpiCard
              titre="En retard"
              valeur={st.synthese.en_retard}
              icone={AlertTriangle}
              couleurIcone="#C0392B"
              fondIcone="#FBEAE7"
              valeurCouleur={st.synthese.en_retard > 0 ? "#C0392B" : undefined}
              bas={`${st.synthese.taux_retard} % des activités`}
            />
            <KpiCard
              titre="Charge totale"
              valeur={formatDuree(st.synthese.minutes_total)}
              icone={Clock}
              couleurIcone="#14708F"
              fondIcone="#E1EFF4"
              bas="durée cumulée saisie"
            />
            <KpiCard
              titre="Heures réalisées"
              valeur={formatDuree(st.synthese.minutes_realisees)}
              icone={Gauge}
              couleurIcone="#0E5E7C"
              fondIcone="#E1EFF4"
              bas="uniquement les tâches clôturées"
            />
            <KpiCard
              titre="Points cumulés"
              valeur={formatPoints(st.synthese.points_total)}
              icone={Award}
              couleurIcone="#B4750E"
              fondIcone="#FBF0DC"
              valeurCouleur="#B4750E"
              bas="pondération (40 h = 5 pts)"
            />
          </div>

          {/* Évolution + catégories */}
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="carte p-[20px_22px]">
              <div className="mb-4">
                <div className="text-[15px] font-semibold text-encre">Évolution sur la période</div>
                <div className="mt-0.5 text-xs text-grisdoux">Activités saisies, clôturées et en retard par mois</div>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={st.evolution_mensuelle} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F3" vertical={false} />
                    <XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{ fill: "#8A99A1", fontSize: 11.5 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8A99A1", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8EB", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" name="Total" fill="#8FB2BF" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="cloturees" name="Clôturées" fill="#1B8A4B" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="en_retard" name="En retard" fill="#C0392B" radius={[4, 4, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="carte p-[20px_22px]">
              <div className="mb-4 text-[15px] font-semibold text-encre">Répartition par catégorie</div>
              <div className="h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={st.repartition_categorie}
                      dataKey="total"
                      nameKey="libelle"
                      innerRadius={38}
                      outerRadius={66}
                      paddingAngle={1}
                      stroke="none"
                    >
                      {st.repartition_categorie.map((c, i) => (
                        <Cell key={i} fill={c.couleur ?? "#8A99A1"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E2E8EB", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                {st.repartition_categorie.map((c) => (
                  <div key={c.cle} className="flex items-center justify-between text-[12.5px]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-none rounded-sm" style={{ background: c.couleur ?? "#8A99A1" }} />
                      <span className="truncate text-ardoise">{c.libelle}</span>
                    </div>
                    <span className="flex-none font-mono text-grisdoux">
                      {c.total} · {formatDuree(c.minutes)}
                    </span>
                  </div>
                ))}
                {st.repartition_categorie.length === 0 && <div className="text-[12.5px] text-grisdoux">Aucune donnée.</div>}
              </div>
            </div>
          </div>

          {/* Statuts + priorités */}
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BlocRepartition titre="Par statut" items={st.repartition_statut} couleurDe={(c) => STATUTS[c as keyof typeof STATUTS]?.couleur ?? "#8A99A1"} />
            <BlocRepartition titre="Par priorité" items={st.repartition_priorite} couleurDe={(c) => PRIORITES[c as keyof typeof PRIORITES]?.couleur ?? "#8A99A1"} />
          </div>

          {/* Performance par agent */}
          <div className="carte mb-4 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#EEF2F3] px-[22px] py-[15px]">
              <Users size={17} className="text-petrole-600" />
              <span className="text-[15px] font-semibold text-encre">Performance par agent</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#EEF2F3] bg-[#FAFBFB] text-left text-[11px] uppercase tracking-wide text-grisdoux">
                    <th className="px-[22px] py-2.5 font-semibold">Agent</th>
                    <th className="py-2.5 text-center font-semibold">Activités</th>
                    <th className="py-2.5 text-center font-semibold">Clôturées</th>
                    <th className="py-2.5 text-center font-semibold">En retard</th>
                    <th className="py-2.5 text-center font-semibold">Charge</th>
                    <th className="py-2.5 text-center font-semibold">Taux clôture</th>
                    <th className="px-[22px] py-2.5 text-right font-semibold">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {st.par_agent.map((a) => (
                    <LigneAgent key={a.user_id} a={a} />
                  ))}
                  {st.par_agent.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[13px] text-grisdoux">
                        Aucune activité sur cette période.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activités en retard */}
          <div className="carte overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#EEF2F3] px-[22px] py-[15px]">
              <AlertTriangle size={17} className={st.activites_en_retard.length ? "text-danger" : "text-grisdoux"} />
              <span className="text-[15px] font-semibold text-encre">
                Activités en retard{" "}
                <span className="text-xs font-normal text-grisdoux">— échéance dépassée, ni terminée ni clôturée</span>
              </span>
              {st.activites_en_retard.length > 0 && (
                <span className="ml-auto rounded-md bg-danger/10 px-2 py-0.5 text-[12px] font-semibold text-danger">
                  {st.activites_en_retard.length}
                </span>
              )}
            </div>
            {st.activites_en_retard.length === 0 ? (
              <div className="px-6 py-10 text-center text-[13px] text-succes">
                ✓ Aucune activité en retard sur cette période.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-[#EEF2F3] bg-[#FAFBFB] text-left text-[11px] uppercase tracking-wide text-grisdoux">
                      <th className="px-[22px] py-2.5 font-semibold">Activité</th>
                      <th className="py-2.5 font-semibold">Agent</th>
                      <th className="py-2.5 font-semibold">Catégorie</th>
                      <th className="py-2.5 font-semibold">Priorité</th>
                      <th className="py-2.5 font-semibold">Statut</th>
                      <th className="py-2.5 text-center font-semibold">Échéance</th>
                      <th className="px-[22px] py-2.5 text-right font-semibold">Retard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {st.activites_en_retard.map((a) => (
                      <tr key={a.id} className="border-b border-[#F4F6F7] last:border-0 hover:bg-[#FAFBFB]">
                        <td className="max-w-0 truncate px-[22px] py-3 pr-4 text-[13px] font-medium text-encre">{a.titre}</td>
                        <td className="py-3 text-[12.5px] text-ardoise">{a.agent}</td>
                        <td className="py-3 text-[12.5px] text-gris">{a.categorie}</td>
                        <td className="py-3 text-[12.5px] text-gris">{a.priorite}</td>
                        <td className="py-3 text-[12.5px] text-gris">{a.statut}</td>
                        <td className="py-3 text-center font-mono text-[12.5px] text-ardoise">{a.echeance}</td>
                        <td className="px-[22px] py-3 text-right">
                          <span className="rounded-md bg-danger/10 px-2 py-1 font-mono text-[12px] font-semibold text-danger">
                            {a.jours_retard} j
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

function LigneAgent({ a }: { a: AgentStat }) {
  return (
    <tr className="border-b border-[#F4F6F7] last:border-0 hover:bg-[#FAFBFB]">
      <td className="px-[22px] py-3">
        <div className="flex items-center gap-2.5">
          <Avatar nom={a.nom_complet} id={a.user_id} taille={28} />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-encre">{a.nom_complet}</div>
            <div className="truncate text-[11px] text-grisdoux">{a.poste || "—"}</div>
          </div>
        </div>
      </td>
      <td className="py-3 text-center font-mono text-[13px] text-ardoise">{a.total}</td>
      <td className="py-3 text-center font-mono text-[13px] font-semibold text-succes">{a.cloturees}</td>
      <td className="py-3 text-center font-mono text-[13px]" style={{ color: a.en_retard > 0 ? "#C0392B" : "#8A99A1" }}>
        {a.en_retard}
      </td>
      <td className="py-3 text-center font-mono text-[12.5px] text-ardoise">{formatDuree(a.minutes)}</td>
      <td className="py-3">
        <div className="mx-auto flex w-[110px] items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0F3F4]">
            <div className="h-full rounded-full bg-succes" style={{ width: `${a.taux_cloture}%` }} />
          </div>
          <span className="w-9 text-right font-mono text-[11.5px] text-gris">{a.taux_cloture}%</span>
        </div>
      </td>
      <td className="px-[22px] py-3 text-right font-mono text-[13px] font-semibold text-encre">{formatPoints(a.points)}</td>
    </tr>
  );
}

function BlocRepartition({
  titre,
  items,
  couleurDe,
}: {
  titre: string;
  items: RepartitionStat[];
  couleurDe: (cle: string) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <div className="carte p-[20px_22px]">
      <div className="mb-4 text-[15px] font-semibold text-encre">{titre}</div>
      <div className="flex flex-col gap-3">
        {items.map((i) => (
          <div key={i.cle} className="flex items-center gap-3">
            <div className="w-24 truncate text-[12.5px] text-ardoise">{i.libelle}</div>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#F0F3F4]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(i.total / max) * 100}%`, background: couleurDe(i.cle) }}
              />
            </div>
            <div className="w-24 text-right font-mono text-[11.5px] text-gris">
              {i.total} · {i.pourcentage}%
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-[12.5px] text-grisdoux">Aucune donnée.</div>}
      </div>
    </div>
  );
}
