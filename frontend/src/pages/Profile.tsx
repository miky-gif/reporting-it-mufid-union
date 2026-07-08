import { Mail, Shield, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Avatar } from "@/components/ui/Avatar";
import { EnteteSection, Spinner } from "@/components/ui/Divers";
import type { StatsEmploye } from "@/types";
import { formatDate, formatHeures } from "@/lib/format";

export default function Profile() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsEmploye | null>(null);

  useEffect(() => {
    api.get<StatsEmploye>("/stats/employe").then((r) => setStats(r.data));
  }, []);

  if (!user) return <Spinner />;

  return (
    <>
      <EnteteSection titre="Mon profil" sousTitre="Vos informations et votre activité récapitulée." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="carte p-7">
          <div className="flex items-center gap-4">
            <Avatar nom={user.nom_complet} id={user.id} taille={64} />
            <div>
              <div className="text-lg font-semibold text-encre">{user.nom_complet}</div>
              <div className="text-[13.5px] text-gris">{user.poste ?? "—"}</div>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3.5">
            <LigneInfo icone={Mail} label="E-mail" valeur={user.email} />
            <LigneInfo icone={Shield} label="Rôle" valeur={user.role === "ADMIN" ? "Administrateur" : "Employé"} />
            <LigneInfo icone={UserIcon} label="Membre depuis" valeur={formatDate(user.date_creation)} />
          </div>
        </div>

        <div className="carte p-7">
          <div className="mb-4 text-[15px] font-semibold text-encre">Récapitulatif de mon activité</div>
          {!stats ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <StatBloc label="Total activités" valeur={String(stats.total_activites)} />
              <StatBloc label="Heures cumulées" valeur={formatHeures(stats.heures_cumulees)} couleur="#0E5E7C" />
              <StatBloc label="Taux de complétion" valeur={`${stats.taux_completion} %`} couleur="#1B8A4B" />
              <StatBloc label="En cours" valeur={String(stats.en_cours)} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function LigneInfo({ icone: Icone, label, valeur }: { icone: typeof Mail; label: string; valeur: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-bordure bg-surface px-3.5 py-3">
      <Icone size={18} className="text-petrole-600" />
      <div>
        <div className="text-[11px] uppercase tracking-wide text-grisdoux">{label}</div>
        <div className="text-[13.5px] font-medium text-encre">{valeur}</div>
      </div>
    </div>
  );
}

function StatBloc({ label, valeur, couleur = "#16262E" }: { label: string; valeur: string; couleur?: string }) {
  return (
    <div className="rounded-xl2 border border-[#EEF2F3] p-4">
      <div className="text-[11.5px] text-grisdoux">{label}</div>
      <div className="mt-1.5 font-mono text-[27px] font-semibold" style={{ color: couleur }}>
        {valeur}
      </div>
    </div>
  );
}
