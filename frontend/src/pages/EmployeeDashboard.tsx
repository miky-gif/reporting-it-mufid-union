import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Gauge,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDateLongue, formatHeures } from "@/lib/format";
import { STATUTS } from "@/lib/constants";
import type { Activite, PageActivites, StatsEmploye } from "@/types";
import { BarreProgression, KpiCard, TendanceHausse } from "@/components/ui/KpiCard";
import { CategorieTag, StatutBadge } from "@/components/ui/Badges";
import { EnteteSection } from "@/components/ui/Divers";
import { Spinner } from "@/components/ui/Divers";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsEmploye | null>(null);
  const [recentes, setRecentes] = useState<Activite[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<StatsEmploye>("/stats/employe"),
      api.get<PageActivites>("/activites", { params: { taille: 5, tri: "date_activite", ordre: "desc" } }),
    ])
      .then(([s, a]) => {
        setStats(s.data);
        setRecentes(a.data.items);
      })
      .finally(() => setChargement(false));
  }, []);

  if (chargement || !stats) return <Spinner />;

  const prenom = user?.nom_complet.split(" ")[0] ?? "";
  const maxSemaine = Math.max(1, ...stats.activite_semaine.map((j) => j.valeur));

  return (
    <>
      <EnteteSection
        titre={`Bonjour, ${prenom}`}
        sousTitre={`${capitaliser(formatDateLongue())} — voici l'état de vos activités.`}
        action={
          <button onClick={() => navigate("/activites/nouvelle")} className="btn-primaire">
            <Plus size={19} /> Nouvelle activité
          </button>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titre="Tâches du jour"
          valeur={stats.taches_du_jour}
          icone={CalendarDays}
          couleurIcone="#14708F"
          fondIcone="#E1EFF4"
          bas="à réaliser aujourd'hui"
        />
        <KpiCard
          titre="En cours"
          valeur={stats.en_cours}
          icone={CircleDashed}
          couleurIcone="#14708F"
          fondIcone="#E1EFF4"
          bas={stats.bloquees > 0 ? `${stats.bloquees} bloquée(s)` : "aucune bloquée"}
        />
        <KpiCard
          titre="Terminées cette semaine"
          valeur={stats.terminees_semaine}
          icone={CheckCircle2}
          couleurIcone="#1B8A4B"
          fondIcone="#E4F5EB"
          bas={<TendanceHausse valeur={`${stats.terminees_semaine}`} texte="cette semaine" />}
        />
        <KpiCard
          titre="Taux de complétion"
          valeur={`${stats.taux_completion} %`}
          icone={Gauge}
          couleurIcone="#1B8A4B"
          fondIcone="#E4F5EB"
          valeurCouleur="#1B8A4B"
          bas={<BarreProgression valeur={stats.taux_completion} />}
        />
      </div>

      {/* Graphiques */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="carte p-[20px_22px]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="text-[15px] font-semibold text-encre">Activité de la semaine</div>
              <div className="mt-0.5 text-xs text-grisdoux">Activités saisies par jour</div>
            </div>
            <span className="rounded-md border border-[#E8EDEE] bg-surface px-2.5 py-1 font-mono text-[11px] text-gris">
              {stats.activite_semaine.reduce((s, j) => s + j.valeur, 0)} au total
            </span>
          </div>
          <div className="h-[186px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.activite_semaine} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                <XAxis
                  dataKey="jour"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#8A99A1", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(14,94,124,.06)" }}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8EB", fontSize: 12 }}
                  labelStyle={{ color: "#16262E", fontWeight: 600 }}
                  formatter={(v) => [`${v} activité(s)`, ""]}
                />
                <Bar dataKey="valeur" radius={[6, 6, 0, 0]} maxBarSize={34}>
                  {stats.activite_semaine.map((j, i) => (
                    <Cell key={i} fill={j.valeur >= maxSemaine ? "#0E5E7C" : "#7FB0C0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="carte p-[20px_22px]">
          <div className="mb-4 text-[15px] font-semibold text-encre">Mes activités par statut</div>
          <div className="flex flex-col gap-4">
            {stats.repartition_statut.map((r) => {
              const st = STATUTS[r.cle as keyof typeof STATUTS];
              return (
                <div key={r.cle}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: st.couleur }} />
                      <span className="text-[13px] font-medium text-ardoise">{st.libelle}</span>
                    </div>
                    <span className="font-mono text-xs text-gris">{r.pourcentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F0F3F4]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${r.pourcentage}%`, background: st.couleur }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Activités récentes */}
      <div className="carte overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#EEF2F3] px-[22px] py-[17px]">
          <div className="text-[15px] font-semibold text-encre">Activités récentes</div>
          <Link to="/activites" className="flex items-center gap-1 text-[13px] font-medium text-petrole-600">
            Voir tout <ChevronRight size={17} />
          </Link>
        </div>
        {recentes.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gris">Aucune activité pour le moment.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#EEF2F3] text-left text-[11px] uppercase tracking-wide text-grisdoux">
                <th className="px-[22px] py-2.5 font-semibold">Réf.</th>
                <th className="py-2.5 font-semibold">Activité</th>
                <th className="py-2.5 font-semibold">Catégorie</th>
                <th className="py-2.5 font-semibold">Statut</th>
                <th className="px-[22px] py-2.5 text-right font-semibold">Durée</th>
              </tr>
            </thead>
            <tbody>
              {recentes.map((a) => (
                <tr key={a.id} className="border-b border-[#F4F6F7] last:border-0">
                  <td className="px-[22px] py-3 font-mono text-xs text-grisdoux">{a.reference}</td>
                  <td className="max-w-0 truncate py-3 pr-4 text-[13.5px] font-medium text-encre">
                    {a.titre}
                  </td>
                  <td className="py-3">
                    <CategorieTag categorie={a.categorie} compact />
                  </td>
                  <td className="py-3">
                    <StatutBadge statut={a.statut} />
                  </td>
                  <td className="px-[22px] py-3 text-right font-mono text-[13px] text-ardoise">
                    {formatHeures(a.duree_heures)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function capitaliser(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
