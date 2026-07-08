import { Clock, Gauge, LayoutList, TrendingUp, Users as UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { api } from "@/lib/api";
import { formatHeures } from "@/lib/format";
import type { StatsAdmin } from "@/types";
import { KpiCard, BarreProgression } from "@/components/ui/KpiCard";
import { Avatar } from "@/components/ui/Avatar";
import { EnteteSection, Spinner } from "@/components/ui/Divers";

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsAdmin | null>(null);

  useEffect(() => {
    api.get<StatsAdmin>("/stats/admin").then((r) => setStats(r.data));
  }, []);

  if (!stats) return <Spinner />;

  const donutData = stats.repartition_categorie.map((r) => ({
    name: r.libelle,
    value: r.total,
    couleur: r.couleur ?? "#8A99A1",
    pct: r.pourcentage,
  }));
  const maxHeures = Math.max(1, ...stats.charge_par_employe.map((c) => c.heures));
  const maxContrib = Math.max(1, ...stats.top_contributeurs.map((c) => c.nb_activites));

  return (
    <>
      <EnteteSection
        titre="Vue d'ensemble du service IT"
        sousTitre="Activité consolidée du personnel."
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard titre="Total activités" valeur={stats.total_activites} icone={LayoutList} bas="sur la période" />
        <KpiCard titre="Employés actifs" valeur={stats.employes_actifs} icone={UsersIcon} bas="membres du service" />
        <KpiCard
          titre="Taux de complétion"
          valeur={`${stats.taux_completion} %`}
          icone={Gauge}
          couleurIcone="#1B8A4B"
          fondIcone="#E4F5EB"
          valeurCouleur="#1B8A4B"
          bas={<BarreProgression valeur={stats.taux_completion} />}
        />
        <KpiCard
          titre="Heures cumulées"
          valeur={
            <>
              {stats.heures_cumulees.toLocaleString("fr-FR")} <span className="text-base text-grisdoux">h</span>
            </>
          }
          icone={Clock}
          couleurIcone="#B4750E"
          fondIcone="#FBF0DC"
          bas={
            stats.employes_actifs
              ? `≈ ${Math.round(stats.heures_cumulees / stats.employes_actifs)} h / employé`
              : undefined
          }
        />
      </div>

      {/* Évolution + donut */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="carte p-[20px_22px]">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <div className="text-[15px] font-semibold text-encre">Évolution des activités</div>
              <div className="mt-0.5 text-xs text-grisdoux">Nombre d'activités enregistrées par mois</div>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp size={16} className="text-succes" />
              <span className="font-mono text-[13px] text-succes">6 mois</span>
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.evolution_mensuelle} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="aireEvo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0E5E7C" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#0E5E7C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{ fill: "#8A99A1", fontSize: 11.5 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #E2E8EB", fontSize: 12 }}
                  formatter={(v) => [`${v} activité(s)`, ""]}
                />
                <Area
                  type="monotone"
                  dataKey="valeur"
                  stroke="#0E5E7C"
                  strokeWidth={2.5}
                  fill="url(#aireEvo)"
                  dot={{ r: 3, fill: "#fff", stroke: "#0E5E7C", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="carte p-[20px_22px]">
          <div className="mb-4 text-[15px] font-semibold text-encre">Répartition par catégorie</div>
          <div className="flex items-center gap-5">
            <div className="relative h-[118px] w-[118px] flex-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={34} outerRadius={58} paddingAngle={1} stroke="none">
                    {donutData.map((d, i) => (
                      <Cell key={i} fill={d.couleur} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-mono text-[22px] font-semibold text-encre">{stats.total_activites}</div>
                <div className="text-[10px] text-grisdoux">activités</div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.couleur }} />
                    <span className="text-[12.5px] text-ardoise">{d.name}</span>
                  </div>
                  <span className="font-mono text-xs text-gris">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Charge + top contributeurs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className="carte p-[20px_22px]">
          <div className="mb-4 text-[15px] font-semibold text-encre">
            Charge par employé <span className="text-xs font-normal text-grisdoux">— heures sur la période</span>
          </div>
          <div className="flex flex-col gap-3.5">
            {stats.charge_par_employe.map((c) => (
              <div key={c.user_id} className="flex items-center gap-3">
                <div className="w-28 truncate text-[13px] font-medium text-ardoise">{c.nom_complet}</div>
                <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-[#F0F3F4]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1B7C9E] to-petrole-600"
                    style={{ width: `${(c.heures / maxHeures) * 100}%` }}
                  />
                </div>
                <div className="w-12 text-right font-mono text-[12.5px] font-semibold text-encre">
                  {formatHeures(c.heures)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="carte p-[20px_22px]">
          <div className="mb-4 text-[15px] font-semibold text-encre">Top contributeurs</div>
          <div className="flex flex-col gap-3.5">
            {stats.top_contributeurs.map((c, i) => (
              <div key={c.user_id} className="flex items-center gap-3">
                <span
                  className="w-5 text-center font-mono text-sm font-bold"
                  style={{ color: i === 0 ? "#B4750E" : i < 3 ? "#5E717B" : "#9AA7AD" }}
                >
                  {i + 1}
                </span>
                <Avatar nom={c.nom_complet} id={c.user_id} taille={34} />
                <div className="flex-1">
                  <div className="text-[13px] font-medium text-encre">{c.nom_complet}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F0F3F4]">
                    <div
                      className="h-full"
                      style={{ width: `${(c.nb_activites / maxContrib) * 100}%`, background: i < 3 ? "#0E5E7C" : "#8FB2BF" }}
                    />
                  </div>
                </div>
                <span className="font-mono text-[13px] font-semibold text-encre">{c.nb_activites}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
