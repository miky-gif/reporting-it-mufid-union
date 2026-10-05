import { ArrowDown, ArrowUp, Download, Pencil, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, messageErreur } from "@/lib/api";
import { LISTE_PRIORITES, LISTE_STATUTS, PRIORITES, STATUTS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { useCategories } from "@/context/CategoriesContext";
import { formatDate, formatDuree } from "@/lib/format";
import type { Activite, Categorie, PageActivites, Priorite, Statut } from "@/types";
import { CategorieTag, PrioriteBadge, StatutBadge } from "@/components/ui/Badges";
import { EnteteSection, EtatVide, Spinner } from "@/components/ui/Divers";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BasculeVue, VueTableau } from "@/components/ui/VueTableau";

const TAILLE = 8;
// La vue tableau affiche toutes les colonnes d'un coup : on charge le maximum
// autorisé par l'API (100) plutôt qu'une page.
const TAILLE_TABLEAU = 100;

export default function MyActivities() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { actives: categoriesActives } = useCategories();
  const [donnees, setDonnees] = useState<PageActivites | null>(null);
  const [chargement, setChargement] = useState(true);
  const [aSupprimer, setASupprimer] = useState<Activite | null>(null);

  // Les filtres sont portés par l'URL : ils survivent à l'aller-retour vers une
  // tâche, et la vue filtrée reste partageable / navigable (bouton Précédent).
  const [params, setParams] = useSearchParams();
  const recherche = params.get("q") ?? "";
  const categorie = (params.get("cat") ?? "") as Categorie | "";
  const statut = (params.get("statut") ?? "") as Statut | "";
  const priorite = (params.get("priorite") ?? "") as Priorite | "";
  const TRIS = ["date_activite", "duree_minutes", "titre"] as const;
  const triParam = params.get("tri") ?? "";
  const tri = (TRIS as readonly string[]).includes(triParam)
    ? (triParam as (typeof TRIS)[number])
    : "date_activite";
  const ordre: "asc" | "desc" = params.get("ordre") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const vue: "liste" | "tableau" = params.get("vue") === "tableau" ? "tableau" : "liste";

  /** Met à jour un filtre dans l'URL (et revient page 1, sauf pagination). */
  function majParams(modifs: Record<string, string>, retourPage1 = true) {
    const p = new URLSearchParams(params);
    for (const [cle, valeur] of Object.entries(modifs)) {
      if (valeur) p.set(cle, valeur);
      else p.delete(cle);
    }
    if (retourPage1) p.delete("page");
    setParams(p, { replace: true }); // replace : pas d'entrée d'historique par frappe
  }

  const setRecherche = (v: string) => majParams({ q: v });
  const setCategorie = (v: Categorie | "") => majParams({ cat: v });
  const setStatut = (v: Statut | "") => majParams({ statut: v });
  const setPriorite = (v: Priorite | "") => majParams({ priorite: v });
  const setPage = (p: number) => majParams({ page: p > 1 ? String(p) : "" }, false);
  const setVue = (v: "liste" | "tableau") => majParams({ vue: v === "tableau" ? "tableau" : "" });

  const charger = useCallback(() => {
    setChargement(true);
    api
      .get<PageActivites>("/activites", {
        params: {
          // « Mes activités » = uniquement les miennes, même pour un admin/superviseur
          // (dont la liste par défaut couvrirait tout le département).
          user_id: user?.id,
          page: vue === "tableau" ? 1 : page,
          taille: vue === "tableau" ? TAILLE_TABLEAU : TAILLE,
          tri,
          ordre,
          recherche: recherche || undefined,
          categorie: categorie || undefined,
          statut: statut || undefined,
          priorite: priorite || undefined,
        },
      })
      .then((r) => setDonnees(r.data))
      .finally(() => setChargement(false));
  }, [user?.id, page, tri, ordre, recherche, categorie, statut, priorite, vue]);

  useEffect(() => {
    const t = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [charger, recherche]);

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      await api.delete(`/activites/${aSupprimer.id}`);
      setASupprimer(null);
      charger();
    } catch (err) {
      alert(messageErreur(err));
    }
  }

  function basculerTriDate() {
    majParams({ tri: "date_activite", ordre: ordre === "desc" ? "asc" : "desc" });
  }

  const filtresActifs = !!(recherche || categorie || statut || priorite);

  return (
    <>
      <EnteteSection
        titre="Mes activités"
        sousTitre={donnees ? `${donnees.total} activité(s) enregistrée(s).` : " "}
        action={
          <div className="flex flex-wrap gap-2.5">
            <button
              className="btn-secondaire"
              onClick={() => alert("L'export est disponible pour l'administrateur via les rapports.")}
            >
              <Download size={18} /> Exporter
            </button>
            <BasculeVue vue={vue} onChanger={setVue} />
            <button onClick={() => navigate("/activites/nouvelle")} className="btn-primaire">
              <Plus size={18} /> Nouvelle activité
            </button>
          </div>
        }
      />

      <div className="carte overflow-hidden">
        {/* Barre d'outils */}
        <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-[#EEF2F3] px-[18px] py-3.5">
          <div className="flex max-w-[320px] flex-1 items-center gap-2.5 rounded-lg border border-[#E8EDEE] bg-surface px-3 py-2.5">
            <Search size={18} className="text-grisdoux" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par titre ou réf…"
              className="w-full bg-transparent text-[13px] text-encre outline-none placeholder:text-grisdoux"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SelectFiltre valeur={categorie} onChange={(v) => setCategorie(v as Categorie | "")} defaut="Catégorie">
              {categoriesActives.map((c) => (
                <option key={c.code} value={c.code}>{c.nom}</option>
              ))}
            </SelectFiltre>
            <SelectFiltre valeur={statut} onChange={(v) => setStatut(v as Statut | "")} defaut="Statut">
              {LISTE_STATUTS.map((s) => (
                <option key={s} value={s}>{STATUTS[s].libelle}</option>
              ))}
            </SelectFiltre>
            <SelectFiltre valeur={priorite} onChange={(v) => setPriorite(v as Priorite | "")} defaut="Priorité">
              {LISTE_PRIORITES.map((p) => (
                <option key={p} value={p}>{PRIORITES[p].libelle}</option>
              ))}
            </SelectFiltre>
          </div>
        </div>

        {chargement && !donnees ? (
          <Spinner />
        ) : donnees && donnees.items.length === 0 ? (
          <EtatVide
            icone={filtresActifs ? SearchX : Plus}
            titre={filtresActifs ? "Aucun résultat" : "Aucune activité pour le moment"}
            description={
              filtresActifs
                ? "Aucune activité ne correspond à vos critères. Essayez d'élargir la période ou de retirer un filtre."
                : "Commencez par enregistrer votre première tâche. Elle apparaîtra ensuite dans votre tableau de bord et vos rapports."
            }
            action={
              filtresActifs ? (
                <button className="btn-secondaire" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Réinitialiser les filtres
                </button>
              ) : (
                <button className="btn-primaire" onClick={() => navigate("/activites/nouvelle")}>
                  <Plus size={18} /> Saisir une activité
                </button>
              )
            }
          />
        ) : vue === "tableau" ? (
          <VueTableau
            activites={donnees!.items}
            onOuvrir={(act) =>
              navigate(`/activites/${act.id}/modifier`, {
                state: { retour: location.pathname + location.search },
              })
            }
            onChange={charger}
          />
        ) : (
          <>
            {/* En-tête figé : les intitulés de colonne restent lisibles
                quand on parcourt une longue liste. */}
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 290px)" }}>
              <table className="w-full min-w-[820px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#EEF2F3] bg-[#FAFBFB] text-left text-[11px] uppercase tracking-wide text-grisdoux [&>th]:bg-[#FAFBFB]">
                    <th className="px-[18px] py-2.5 font-semibold">Réf.</th>
                    <th className="py-2.5 font-semibold">Activité</th>
                    <th className="py-2.5 font-semibold">Priorité</th>
                    <th className="py-2.5 font-semibold">Statut</th>
                    <th className="py-2.5 font-semibold">
                      <button onClick={basculerTriDate} className="flex items-center gap-1 text-petrole-600">
                        Date {ordre === "desc" ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                      </button>
                    </th>
                    <th className="py-2.5 text-right font-semibold">Durée</th>
                    <th className="px-[18px] py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees!.items.map((a) => (
                    <tr key={a.id} className="border-b border-[#F4F6F7] last:border-0 hover:bg-[#FAFBFB]">
                      <td className="px-[18px] py-3 font-mono text-xs text-grisdoux">{a.reference}</td>
                      <td className="max-w-0 py-3 pr-4">
                        <div className="truncate text-[13.5px] font-medium text-encre">{a.titre}</div>
                        <div className="mt-0.5"><CategorieTag categorie={a.categorie} compact /></div>
                      </td>
                      <td className="py-3"><PrioriteBadge priorite={a.priorite} /></td>
                      <td className="py-3"><StatutBadge statut={a.statut} /></td>
                      <td className="py-3 font-mono text-[12.5px] text-gris">{formatDate(a.date_activite)}</td>
                      <td className="py-3 text-right font-mono text-[13px] text-ardoise">{formatDuree(a.duree_minutes)}</td>
                      <td className="px-[18px] py-3">
                        <div className="flex justify-end gap-3 text-grisdoux">
                          <button onClick={() => navigate(`/activites/${a.id}/modifier`, { state: { retour: location.pathname + location.search } })} title="Modifier" className="hover:text-petrole-600">
                            <Pencil size={18} />
                          </button>
                          <button onClick={() => setASupprimer(a)} title="Supprimer" className="hover:text-danger">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={donnees!.page}
              totalPages={donnees!.total_pages}
              total={donnees!.total}
              taille={TAILLE}
              onChange={setPage}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        ouvert={!!aSupprimer}
        titre="Supprimer l'activité"
        message={`« ${aSupprimer?.titre ?? ""} » sera définitivement supprimée. Cette action est irréversible.`}
        libelleConfirmer="Supprimer"
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}

function SelectFiltre({
  valeur,
  onChange,
  defaut,
  children,
}: {
  valeur: string;
  onChange: (v: string) => void;
  defaut: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      className={
        "rounded-lg border px-3 py-2 text-[13px] font-medium outline-none " +
        (valeur ? "border-petrole-600 bg-petrole-50 text-petrole-600" : "border-[#CDD8DC] bg-white text-gris")
      }
    >
      <option value="">{defaut}</option>
      {children}
    </select>
  );
}
