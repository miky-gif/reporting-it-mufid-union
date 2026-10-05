import {
  BarChart3,
  Building2,
  ClipboardList,
  FilePlus2,
  FileText,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  PieChart,
  SendHorizonal,
  Tags,
  UserCircle,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
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
  { to: "/mes-rapports", label: "Mes rapports", icone: FileText },
];

/** Préférence d'affichage de la colonne, propre à chaque poste de travail. */
const CLE_REDUITE = "mufid_nav_reduite";

export function Sidebar({
  ouvert = false,
  onFermer,
}: {
  /** Tiroir ouvert (petits écrans uniquement ; toujours visible en >= lg). */
  ouvert?: boolean;
  onFermer?: () => void;
}) {
  const { estAdmin, estSuperviseur, estSuperAdmin, peut, user } = useAuth();

  // Colonne réduite aux icônes. Le choix est mémorisé sur le poste ; il ne
  // s'applique qu'à partir de « lg » — en tiroir (petit écran), la navigation
  // reste toujours libellée, sans quoi elle deviendrait indéchiffrable.
  const [reduite, setReduite] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CLE_REDUITE) === "1";
    } catch {
      return false; // navigation privée ou stockage refusé
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(CLE_REDUITE, reduite ? "1" : "0");
    } catch {
      /* sans conséquence : la préférence ne sera simplement pas retenue */
    }
  }, [reduite]);

  /** Masqué uniquement en mode réduit, et seulement sur grand écran. */
  const siReduite = (classes: string) => (reduite ? classes : "");

  // La navigation d'administration s'adapte aux droits accordés.
  const liensAdmin: Lien[] = [
    { to: "/admin", label: "Tableau de bord", icone: LayoutDashboard },
    ...(peut("STATISTIQUES_VOIR") ? [{ to: "/admin/statistiques", label: "Statistiques", icone: PieChart }] : []),
    { to: "/admin/activites", label: "Gestion des activités", icone: ClipboardList },
    ...(peut("TACHES_AFFECTER")
      ? [{ to: "/admin/taches/nouvelle", label: "Affecter une tâche", icone: SendHorizonal }]
      : []),
    ...(peut("RAPPORTS_EXPORTER")
      ? [
          { to: "/admin/rapports/individuel", label: "Rapports individuels", icone: FileText },
          { to: "/admin/rapports/consolide", label: "Rapports consolidés", icone: BarChart3 },
        ]
      : []),
  ];

  const liens = estAdmin ? liensAdmin : LIENS_EMPLOYE;
  const fond = estSuperAdmin ? "bg-petrole-900" : estAdmin ? "bg-petrole-800" : "bg-petrole-700";
  const perimetre = estSuperviseur
    ? `${user?.departements_geres?.length ?? 0} département(s) supervisé(s)`
    : estSuperAdmin
    ? "Tous les départements"
    : user?.departement?.nom ?? null;

  return (
    <>
      {/* Voile sombre : ferme le tiroir au clic (petits écrans) */}
      {ouvert && (
        <div
          className="fixed inset-0 z-30 bg-encre/50 lg:hidden"
          onClick={onFermer}
          aria-hidden="true"
        />
      )}
      <aside
        className={clsx(
          "flex w-[238px] flex-none flex-col overflow-y-auto overflow-x-hidden p-[20px_14px]",
          fond,
          // Petits écrans : tiroir hors champ qui glisse sous l'en-tête.
          "fixed bottom-0 left-0 top-[62px] z-40 transition-transform duration-200",
          ouvert ? "translate-x-0" : "-translate-x-full",
          // À partir de lg : colonne fixe classique, toujours visible.
          "lg:static lg:z-auto lg:translate-x-0 lg:self-stretch",
          // Réduite : la largeur suffit aux seules icônes.
          siReduite("lg:w-[70px] lg:px-2 lg:transition-[width] lg:duration-200"),
        )}
      >
        <div className={siReduite("lg:hidden")}>
          <div className="px-3 pb-1 pt-1 font-mono text-[10px] font-semibold tracking-[0.13em] text-[#5E93A4]">
            {estSuperAdmin
              ? "SUPER ADMINISTRATION"
              : estSuperviseur
              ? "SUPERVISION"
              : estAdmin
              ? "ADMINISTRATION"
              : "ESPACE IT"}
          </div>
          {/* Périmètre de rattachement (l'admin et l'IT sont cloisonnés sur un
              département ; le superviseur en gère plusieurs). */}
          {perimetre && (
            <div className="mb-3 truncate px-3 text-[11px] text-[#8FB2BF]">{perimetre}</div>
          )}
        </div>

        {/* Réduite : un simple filet remplace l'intitulé de section. */}
        {reduite && <div className="mx-2 mb-3 hidden h-px bg-white/10 lg:block" />}

        {liens.map((l) => (
          <LienNav key={l.to} lien={l} exact={l.to === "/" || l.to === "/admin"} reduite={reduite} />
        ))}

        <div className="mx-3 my-3.5 h-px bg-white/10" />

        {estAdmin ? (
          <>
            {/* Réservé au super administrateur */}
            {estSuperAdmin && (
              <LienNav
                lien={{ to: "/admin/departements", label: "Départements", icone: Building2 }}
                reduite={reduite}
              />
            )}
            {peut("CATEGORIES_GERER") && (
              <LienNav
                lien={{ to: "/admin/categories", label: "Catégories & rubriques", icone: Tags }}
                reduite={reduite}
              />
            )}
            {(peut("IT_CREER") || peut("IT_MODIFIER") || estSuperAdmin) && (
              <LienNav
                lien={{ to: "/admin/utilisateurs", label: "Utilisateurs", icone: Users }}
                reduite={reduite}
              />
            )}
            {/* Espace personnel : l'admin/superviseur/super admin saisit aussi SES activités */}
            <div className="mx-3 my-3.5 h-px bg-white/10" />
            <LienNav
              lien={{ to: "/activites/nouvelle", label: "Saisir une activité", icone: FilePlus2 }}
              reduite={reduite}
            />
            <LienNav
              lien={{ to: "/activites", label: "Mes activités", icone: ListChecks }}
              exact
              reduite={reduite}
            />
            <LienNav
              lien={{ to: "/profil", label: "Mon profil", icone: UserCircle }}
              reduite={reduite}
            />
          </>
        ) : (
          <LienNav lien={{ to: "/profil", label: "Mon profil", icone: UserCircle }} reduite={reduite} />
        )}

        <div className="mt-auto pt-3.5">
          {/* Bascule : seulement là où la colonne est fixe (le tiroir se ferme
              déjà par son propre bouton). */}
          <button
            type="button"
            onClick={() => setReduite((v) => !v)}
            title={reduite ? "Déplier la navigation" : "Réduire la navigation"}
            aria-label={reduite ? "Déplier la navigation" : "Réduire la navigation"}
            aria-pressed={reduite}
            className={clsx(
              "mb-2 hidden w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium text-[#A9C4CE] transition hover:bg-white/5 hover:text-white lg:flex",
              siReduite("lg:justify-center lg:px-0"),
            )}
          >
            {reduite ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            <span className={siReduite("lg:hidden")}>Réduire</span>
          </button>

          <div className={siReduite("lg:hidden")}>
            {!estAdmin && (
              <div className="rounded-xl2 border border-white/10 bg-white/[0.06] p-3.5">
                <div className="mb-1 text-xs font-semibold text-white">Besoin d'aide ?</div>
                <div className="text-[11px] leading-snug text-[#8FB2BF]">
                  Guide de saisie des activités IT.
                </div>
              </div>
            )}
            <div className="mt-3 text-center font-mono text-[10px] text-[#4E7C8C]">MUFID UNION · v1.0</div>
          </div>
        </div>
      </aside>
    </>
  );
}

function LienNav({
  lien,
  exact = false,
  reduite = false,
}: {
  lien: Lien;
  exact?: boolean;
  /** Colonne réduite : on ne garde que l'icône (à partir de « lg »). */
  reduite?: boolean;
}) {
  const Icone = lien.icone;
  return (
    <NavLink
      to={lien.to}
      end={exact}
      // L'infobulle devient la seule façon de lire l'intitulé en mode réduit.
      title={lien.label}
      className={({ isActive }) =>
        clsx(
          "mb-1.5 flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-[13.5px] transition",
          isActive
            ? "bg-petrole-600 font-semibold text-white"
            : "font-medium text-[#A9C4CE] hover:bg-white/5 hover:text-white",
          reduite && "lg:justify-center lg:px-0",
        )
      }
    >
      <Icone size={20} className="flex-none" />
      <span className={clsx("min-w-0 truncate", reduite && "lg:hidden")}>{lien.label}</span>
    </NavLink>
  );
}
