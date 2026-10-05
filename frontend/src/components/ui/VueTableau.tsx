import { AlertTriangle, Clock, Flag, LayoutGrid, List, Lock, PauseCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, messageErreur } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  LISTE_STATUTS,
  LISTE_STATUTS_ADMIN,
  LISTE_STATUTS_EMPLOYE,
  PRIORITES,
  STATUTS,
} from "@/lib/constants";
import { formatDate, formatDuree } from "@/lib/format";
import type { Activite, Statut } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { CategorieTag } from "@/components/ui/Badges";

/**
 * Colonnes du tableau : le seul flux de travail courant.
 *
 * « Standby » en est volontairement ABSENT. C'est un état d'exception, peu
 * employé, dont la colonne consommait une largeur utile aux quatre autres.
 * Les tâches qui s'y trouvent ne sont pas perdues pour autant : un rappel
 * s'affiche au-dessus du tableau et renvoie vers la liste.
 */
const COLONNES: Statut[] = ["A_FAIRE", "EN_COURS", "TERMINE", "CLOTURE"];

/**
 * Vue « tableau » des activités : une colonne par statut, les tâches en
 * cartes que l'on fait glisser d'une colonne à l'autre.
 *
 * Déplacer une carte CHANGE LE STATUT de la tâche. Les règles sont les mêmes
 * qu'en saisie : un agent ne pose ni « À faire » ni « Clôturé », et la
 * clôture exige le droit correspondant. Une colonne interdite se signale
 * pendant le déplacement plutôt que d'échouer au dépôt.
 */
export function VueTableau({
  activites,
  onOuvrir,
  onChange,
  afficherAgent = false,
}: {
  activites: Activite[];
  onOuvrir: (a: Activite) => void;
  /** Rechargement après un déplacement réussi. */
  onChange: () => void;
  /** Affiche l'agent porteur (vue administration). */
  afficherAgent?: boolean;
}) {
  const { user, estAdmin, peut } = useAuth();
  const [tiree, setTiree] = useState<Activite | null>(null);
  const [survolee, setSurvolee] = useState<Statut | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [resteADroite, setResteADroite] = useState(false);
  const defilement = useRef<HTMLDivElement>(null);
  const [params, setParams] = useSearchParams();

  // Les tâches en standby n'ont plus de colonne : on signale leur nombre
  // plutôt que de les faire disparaître sans un mot.
  const enStandby = activites.filter((a) => a.statut === "STANDBY");

  /** Bascule vers la liste, filtrée sur « Standby ». */
  function voirStandby() {
    const p = new URLSearchParams(params);
    p.set("vue", "liste");
    p.set("statut", "STANDBY");
    p.delete("page");
    setParams(p);
  }

  // Y a-t-il des colonnes hors champ ? On le signale par un voile plutôt que
  // de laisser une colonne tranchée au bord, qui se lit comme un défaut.
  useEffect(() => {
    const zone = defilement.current;
    if (!zone) return;
    const mesurer = () =>
      setResteADroite(zone.scrollWidth - zone.clientWidth - zone.scrollLeft > 4);
    mesurer();
    zone.addEventListener("scroll", mesurer);
    window.addEventListener("resize", mesurer);
    return () => {
      zone.removeEventListener("scroll", mesurer);
      window.removeEventListener("resize", mesurer);
    };
  }, [activites.length]);

  // Statuts que CET utilisateur a le droit de poser.
  const autorises: Statut[] = estAdmin
    ? peut("TACHES_CLOTURER")
      ? LISTE_STATUTS
      : LISTE_STATUTS_ADMIN
    : LISTE_STATUTS_EMPLOYE;

  /** Une tâche clôturée est figée ; sinon on vérifie le droit de la modifier. */
  function deplacable(a: Activite): boolean {
    if (a.statut === "CLOTURE") return false;
    if (estAdmin && a.user_id !== user?.id && !peut("TACHES_MODIFIER")) return false;
    return true;
  }

  const accepte = (s: Statut) => autorises.includes(s);

  async function deposer(statut: Statut) {
    const a = tiree;
    setTiree(null);
    setSurvolee(null);
    if (!a || a.statut === statut || !accepte(statut) || !deplacable(a)) return;

    setEnCours(true);
    setErreur(null);
    try {
      await api.put(`/activites/${a.id}`, { statut });
      onChange();
    } catch (err) {
      setErreur(messageErreur(err, "Changement de statut impossible."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      {erreur && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
          <AlertTriangle size={16} className="mt-0.5 flex-none" />
          <span className="min-w-0 flex-1">{erreur}</span>
          <button onClick={() => setErreur(null)} className="flex-none text-[16px] leading-none">
            ×
          </button>
        </div>
      )}

      {enStandby.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[#EFE3C8] bg-attention/5 px-3 py-2 text-[12.5px] text-ardoise">
          <PauseCircle size={15} className="flex-none text-attention" />
          <span className="min-w-0">
            <strong className="font-semibold">{enStandby.length}</strong> tâche(s) en standby —
            non affichées dans le tableau.
          </span>
          <button
            onClick={voirStandby}
            className="font-semibold text-petrole-600 underline-offset-2 hover:underline"
          >
            Les voir dans la liste
          </button>
        </div>
      )}

      {/* Le tableau est SA PROPRE zone de défilement, dans les deux sens.
          Un en-tête ne peut se figer que par rapport au conteneur qui défile
          vraiment : c'est ce qui permet de garder les statuts sous les yeux
          quand une colonne est longue. Rien n'est tronqué pour autant — toutes
          les cartes restent présentes et atteignables. */}
      <div className="relative">
        <div
          ref={defilement}
          className="overflow-auto pb-2"
          style={{ maxHeight: "calc(100vh - 250px)" }}
        >
          <div className="flex items-start gap-4">
          {COLONNES.map((s) => {
            const colonne = activites.filter((a) => a.statut === s);
            const st = STATUTS[s];
            const cible = survolee === s;
            const refus = tiree !== null && (!accepte(s) || !deplacable(tiree));

            // Synthèse de colonne : ce que KanbanFlow ne montre pas — la charge
            // réellement empilée et ce qui y est déjà en retard.
            const minutes = colonne.reduce((n, a) => n + (a.duree_minutes || 0), 0);
            const retards = colonne.filter((a) => a.en_retard && a.statut !== "CLOTURE").length;

            return (
              <div
                key={s}
                onDragOver={(e) => {
                  if (refus) return;
                  e.preventDefault();
                  setSurvolee(s);
                }}
                onDragLeave={() => setSurvolee((c) => (c === s ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  deposer(s);
                }}
                className={
                  "flex min-w-[212px] max-w-[460px] flex-1 flex-col rounded-xl2 border bg-white transition-all duration-150 " +
                  (cible
                    ? "border-petrole-600 shadow-popover ring-2 ring-petrole-600/20"
                    : refus
                    ? "border-dashed border-[#E6CBC6] opacity-50"
                    : "border-bordure shadow-carte")
                }
              >
                {/* En-tête figé : il reste visible tant qu'on parcourt la colonne. */}
                {/* border-b : une fois figé, l'en-tête doit garder une arête
                    nette, car la bordure de la pile défile avec les cartes. */}
                <div className="sticky top-0 z-10 flex-none overflow-hidden rounded-t-xl2 border-b border-[#EEF2F3] bg-white">
                  {/* Filet de couleur : identifie le statut sans alourdir l'en-tête */}
                  <div className="h-[3px] w-full" style={{ background: st.couleur }} />

                  <div className="px-3 pb-2.5 pt-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="min-w-0 flex-1 truncate text-[12.5px] font-semibold"
                      style={{ color: st.couleur }}
                    >
                      {st.libelle}
                    </span>
                    {refus && <Lock size={13} className="flex-none text-grisdoux" />}
                    <span
                      className="flex-none rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
                      style={{ background: st.fond, color: st.couleur }}
                    >
                      {colonne.length}
                    </span>
                  </div>

                    {/* Charge de la colonne + alerte retard */}
                    <div className="mt-1 flex items-center gap-2 text-[10.5px] text-grisdoux">
                      {colonne.length > 0 ? (
                        <>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={10} /> {formatDuree(minutes)}
                          </span>
                          {retards > 0 && (
                            <span className="inline-flex items-center gap-1 font-semibold text-danger">
                              <AlertTriangle size={10} /> {retards} en retard
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="italic">vide</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pile de cartes : aucune limite de hauteur. La colonne
                    s'allonge jusqu'à sa dernière tâche et c'est la page qui
                    défile — un seul défilement vertical pour tout le tableau. */}
                <div className="flex min-h-[92px] flex-col gap-2.5 rounded-b-xl2 border-t border-[#F1F4F5] bg-[#FBFCFC] p-2.5">
                  {colonne.map((a) => (
                    <CarteActivite
                      key={a.id}
                      activite={a}
                      afficherAgent={afficherAgent}
                      deplacable={deplacable(a) && !enCours}
                      enDeplacement={tiree?.id === a.id}
                      onOuvrir={() => onOuvrir(a)}
                      onDragStart={() => setTiree(a)}
                      onDragEnd={() => {
                        setTiree(null);
                        setSurvolee(null);
                      }}
                    />
                  ))}

                  {colonne.length === 0 && (
                    <div
                      className={
                        "flex flex-1 items-center justify-center rounded-lg border border-dashed px-2 py-6 text-center text-[11.5px] transition " +
                        (cible
                          ? "border-petrole-600 bg-petrole-50 font-medium text-petrole-600"
                          : "border-[#DDE5E8] text-grisdoux")
                      }
                    >
                      {cible ? "Déposer ici" : "Aucune tâche"}
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {resteADroite && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent"
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Une carte = une activité                                            */
/* ------------------------------------------------------------------ */
function CarteActivite({
  activite: a,
  afficherAgent,
  deplacable,
  enDeplacement,
  onOuvrir,
  onDragStart,
  onDragEnd,
}: {
  activite: Activite;
  afficherAgent: boolean;
  deplacable: boolean;
  enDeplacement: boolean;
  onOuvrir: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const p = PRIORITES[a.priorite];
  const fige = a.statut === "CLOTURE";
  const enRetard = a.en_retard && !fige;

  // UNE seule couleur gouverne la carte : son ÉTAT s'il est notable
  // (clôturée, en retard), sinon sa priorité. Auparavant le rail, le fond et
  // la barre pouvaient dire trois choses différentes — une carte « Très haute »
  // clôturée était orange avec une barre verte, ce qui se lisait comme un
  // défaut d'affichage. La priorité reste lisible sur son étiquette.
  const teinte = fige
    ? { couleur: "#1B8A4B", fond: "#E4F5EB" }
    : enRetard
    ? { couleur: "#C0392B", fond: "#FBEAE7" }
    : { couleur: p.couleur, fond: p.fond };

  return (
    <div
      draggable={deplacable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOuvrir}
      title={a.titre}
      className={
        // flex-none est INDISPENSABLE : la pile de cartes est un conteneur flex
        // à hauteur plafonnée ; sans cela les cartes se compriment au lieu de
        // laisser la colonne défiler, et leur contenu s'écrase.
        "group relative flex-none overflow-hidden rounded-lg border bg-white transition-all duration-150 " +
        (deplacable ? "cursor-grab active:cursor-grabbing " : "cursor-pointer ") +
        (enDeplacement
          ? "rotate-1 scale-[.98] opacity-50 "
          : "hover:-translate-y-[1px] hover:shadow-popover ") +
        (enRetard ? "border-[#EBC7C1]" : fige ? "border-[#CDE7D8]" : "border-bordure")
      }
      // Dégradé partant de la teinte de la carte : le repérage se fait d'un
      // coup d'œil sans retomber dans l'aplat pastel, qui écrase le texte.
      style={{ background: `linear-gradient(100deg, ${teinte.fond} 0%, #FFFFFF 62%)` }}
    >
      {/* Rail : même couleur que le fond, jamais une autre */}
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: teinte.couleur }} />

      <div className="py-3 pl-3.5 pr-3">
        <div className="mb-1.5 line-clamp-3 break-words text-[12.5px] font-medium leading-snug text-encre">
          {a.titre}
        </div>

        {/* Une seule ligne, toujours : la catégorie se tronque, la priorité
            garde sa place. Des cartes de hauteur régulière se lisent mieux. */}
        <div className="mb-2 flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">
            <CategorieTag categorie={a.categorie} compact />
          </span>
          <span
            className="inline-flex flex-none items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
            style={{ background: p.fond, color: p.couleur }}
            title={`Priorité ${p.libelle.toLowerCase()}`}
          >
            <Flag size={9} /> {p.libelle}
          </span>
        </div>

        {/* Avancement : toujours affiché, même à 0 %, pour que toutes les
            cartes aient la même ossature et donc la même allure. */}
        <div className="mb-2 flex items-center gap-1.5">
          <div className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#ECF1F2]">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, a.pourcentage))}%`,
                background: teinte.couleur,
              }}
            />
          </div>
          <span className="w-[30px] flex-none text-right font-mono text-[9.5px] text-grisdoux">
            {a.pourcentage}%
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10.5px] text-gris">
          <span className="inline-flex flex-none items-center gap-1" title="Durée">
            <Clock size={10} /> {formatDuree(a.duree_minutes)}
          </span>
          <span
            className={"min-w-0 flex-1 truncate " + (enRetard ? "font-semibold text-danger" : "")}
            title={`Échéance : ${formatDate(a.date_activite)}`}
          >
            {enRetard ? "⏱ " : ""}
            {formatDate(a.date_activite)}
          </span>
          {fige && <Lock size={11} className="flex-none text-succes" aria-label="Clôturée" />}
          {afficherAgent && a.user && (
            <span className="flex-none" title={a.user.nom_complet}>
              <Avatar nom={a.user.nom_complet} id={a.user.id} taille={20} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bascule Liste / Tableau                                             */
/* ------------------------------------------------------------------ */
export function BasculeVue({
  vue,
  onChanger,
}: {
  vue: "liste" | "tableau";
  onChanger: (v: "liste" | "tableau") => void;
}) {
  const choix = [
    { cle: "liste" as const, libelle: "Liste", icone: List },
    { cle: "tableau" as const, libelle: "Tableau", icone: LayoutGrid },
  ];
  return (
    <div className="inline-flex flex-none items-center rounded-lg border border-bordure bg-white p-1">
      {choix.map(({ cle, libelle, icone: Icone }) => (
        <button
          key={cle}
          type="button"
          onClick={() => onChanger(cle)}
          aria-pressed={vue === cle}
          title={`Affichage en ${libelle.toLowerCase()}`}
          className={
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition " +
            (vue === cle ? "bg-petrole-600 text-white shadow-carte" : "text-gris hover:bg-surface")
          }
        >
          <Icone size={15} />
          {libelle}
        </button>
      ))}
    </div>
  );
}
