import {
  BarChart3,
  ClipboardList,
  FilePlus2,
  FileText,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  PieChart,
  SendHorizonal,
  ShieldCheck,
  Tags,
  UserCircle,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

interface Lien {
  to: string;
  label: string;
  icone: LucideIcon;
}

const LIENS_EMPLOYE: Lien[] = [
  { to: "/", label: "Tableau de bord", icone: LayoutDashboard },
  { to: "/activites/nouvelle", label: "Saisir une activité", icone: FilePlus2 },
  { to: "/activites", label: "Mes activités", icone: ListChecks },
];

const LIENS_ADMIN: Lien[] = [
  { to: "/admin", label: "Tableau de bord", icone: LayoutDashboard },
  { to: "/admin/statistiques", label: "Statistiques", icone: PieChart },
  { to: "/admin/activites", label: "Gestion des activités", icone: ClipboardList },
  { to: "/admin/taches/nouvelle", label: "Affecter une tâche", icone: SendHorizonal },
  { to: "/admin/rapports/individuel", label: "Rapports individuels", icone: FileText },
  { to: "/admin/rapports/consolide", label: "Rapports consolidés", icone: BarChart3 },
];

export function Sidebar() {
  const { estAdmin } = useAuth();
  const liens = estAdmin ? LIENS_ADMIN : LIENS_EMPLOYE;
  const fond = estAdmin ? "bg-petrole-800" : "bg-petrole-700";

  return (
    <aside className={clsx("flex w-[238px] flex-none flex-col self-stretch p-[20px_14px]", fond)}>
      <div className="px-3 pb-3.5 pt-1 font-mono text-[10px] font-semibold tracking-[0.13em] text-[#5E93A4]">
        {estAdmin ? "ADMINISTRATION" : "ESPACE IT"}
      </div>

      {liens.map((l) => (
        <LienNav key={l.to} lien={l} exact={l.to === "/" || l.to === "/admin"} />
      ))}

      <div className="mx-3 my-3.5 h-px bg-white/10" />

      {estAdmin ? (
        <>
          <LienNav lien={{ to: "/admin/categories", label: "Catégories & rubriques", icone: Tags }} />
          <LienNav lien={{ to: "/admin/utilisateurs", label: "Utilisateurs", icone: Users }} />
        </>
      ) : (
        <LienNav lien={{ to: "/profil", label: "Mon profil", icone: UserCircle }} />
      )}

      <div className="mt-auto px-3 pt-3.5">
        {estAdmin ? (
          <div className="flex items-center gap-2 rounded-lg border border-[rgba(31,157,116,.28)] bg-[rgba(31,157,116,.14)] px-3 py-2.5">
            <ShieldCheck size={18} className="text-[#5FBB84]" />
            <div className="text-[11px] leading-tight text-[#B7DEC9]">
              Conforme COBAC
              <br />
              <span className="text-[#6E9DAB]">Traçabilité activée</span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl2 border border-white/10 bg-white/[0.06] p-3.5">
            <div className="mb-1 text-xs font-semibold text-white">Besoin d'aide ?</div>
            <div className="text-[11px] leading-snug text-[#8FB2BF]">
              Guide de saisie des activités IT.
            </div>
          </div>
        )}
        <div className="mt-3 text-center font-mono text-[10px] text-[#4E7C8C]">MUFID UNION · v1.0</div>
      </div>
    </aside>
  );
}

function LienNav({ lien, exact = false }: { lien: Lien; exact?: boolean }) {
  const Icone = lien.icone;
  return (
    <NavLink
      to={lien.to}
      end={exact}
      className={({ isActive }) =>
        clsx(
          "mb-1.5 flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13.5px] transition",
          isActive
            ? "bg-petrole-600 font-semibold text-white"
            : "font-medium text-[#A9C4CE] hover:bg-white/5 hover:text-white",
        )
      }
    >
      <Icone size={20} />
      {lien.label}
    </NavLink>
  );
}
