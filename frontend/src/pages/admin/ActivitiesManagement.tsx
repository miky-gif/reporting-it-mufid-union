import { ArrowDown, ArrowUp, CheckCheck, Filter, Loader2, Pencil, Repeat2, Search, SendHorizonal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { LIBELLE_RECURRENCE, LISTE_PRIORITES, LISTE_STATUTS, PRIORITES, STATUTS } from "@/lib/constants";
import { useCategories } from "@/context/CategoriesContext";
import { formatDate, formatDuree } from "@/lib/format";
import type { Activite, Categorie, PageActivites, Priorite, Statut, UserWithStats } from "@/types";
import { CategorieTag, PrioriteBadge, StatutBadge } from "@/components/ui/Badges";
import { Avatar } from "@/components/ui/Avatar";
import { EnteteSection, EtatVide, Spinner } from "@/components/ui/Divers";
import { BasculeVue, VueTableau } from "@/components/ui/VueTableau";
import { Pagination } from "@/components/ui/Pagination";
import { ReassignModal } from "./ReassignModal";
import { SearchX } from "lucide-react";

const TAILLE = 9;
// La vue tableau garnit toutes les colonnes d'un coup : on charge le maximum
// autorisé par l'API (100) plutôt qu'une page.
const TAILLE_TABLEAU = 100;

// Le filtre de statut accepte aussi le pseudo-statut « EN_RETARD ».
type FiltreStatut = Statut | "EN_RETARD" | "";

export default function ActivitiesManagement() {
  const navigate = useNavigate();
  // Sert à mémoriser d'où l'on vient (filtres compris) avant d'ouvrir une tâche.
  const emplacement = useLocation();
  const { actives: categoriesActives } = useCategories();
  const [donnees, setDonnees] = useState<PageActivites | null>(null);
  const [employes, setEmployes] = useState<UserWithStats[]>([]);
  const [chargement, setChargement] = useState(true);
  const [aReaffecter, setAReaffecter] = useState<Activite | null>(null);

  // Les filtres sont portés par l'URL : ils survivent ainsi à l'aller-retour
  // vers une tâche, et la vue filtrée reste partageable / navigable (précédent).
  const [params, setParams] = useSearchParams();
  const recherche = params.get("q") ?? "";
  const userId = params.get("agent") ?? "";
  const categorie = (params.get("cat") ?? "") as Categorie | "";
  const statut = (params.get("statut") ?? "") as FiltreStatut;
  const priorite = (params.get("priorite") ?? "") as Priorite | "";
  const ordre: "asc" | "desc" = params.get("ordre") === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const vue: "liste" | "tableau" = params.get("vue") === "tableau" ? "tableau" : "liste";

  /** Met à jour un filtre dans l'URL (et revient page 1, sauf pagination). */
  function majParam(cle: string, valeur: string, retourPage1 = true) {
    const p = new URLSearchParams(params);
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    if (retourPage1) p.delete("page");
    setParams(p, { replace: true }); // replace : pas d'entrée d'historique par frappe
  }

  const setRecherche = (v: string) => majParam("q", v);
  const setUserId = (v: string) => majParam("agent", v);
  const setCategorie = (v: Categorie | "") => majParam("cat", v);
  const setStatut = (v: FiltreStatut) => majParam("statut", v);
  const setPriorite = (v: Priorite | "") => majParam("priorite", v);
  const setPage = (p: number) => majParam("page", p > 1 ? String(p) : "", false);
  const setVue = (v: "liste" | "tableau") => majParam("vue", v === "tableau" ? "tableau" : "");
  const basculerOrdre = () => majParam("ordre", ordre === "desc" ? "asc" : "desc");

  useEffect(() => {
    api.get<UserWithStats[]>("/users").then((r) => setEmployes(r.data));
  }, []);

  const charger = useCallback(() => {
    setChargement(true);
    api
      .get<PageActivites>("/activites", {
        params: {
          page: vue === "tableau" ? 1 : page,
          taille: vue === "tableau" ? TAILLE_TABLEAU : TAILLE,
          tri: "date_activite",
          ordre,
          recherche: recherche || undefined,
          user_id: userId || undefined,
          categorie: categorie || undefined,
          statut: statut || undefined,
          priorite: priorite || undefined,
        },
      })
      .then((r) => setDonnees(r.data))
      .finally(() => setChargement(false));
  }, [page, ordre, recherche, userId, categorie, statut, priorite, vue]);

  useEffect(() => {
    const t = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(t);
  }, [charger, recherche]);

  const nbFiltres = [userId, categorie, statut, priorite].filter(Boolean).length;

  function reinitialiser() {
    setParams(new URLSearchParams(), { replace: true });
  }

  return (
    <>
      <EnteteSection
        titre="Gestion des activités"
        sousTitre={donnees ? `${donnees.total} activité(s) — tout le personnel IT.` : " "}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <BasculeVue vue={vue} onChanger={setVue} />
            <button className="btn-primaire" onClick={() => navigate("/admin/taches/nouvelle")}>
              <SendHorizonal size={18} /> Affecter une tâche
            </button>
          </div>
        }
      />

      <div className="carte overflow-hidden">
        {/* Filtres avancés */}
        <div className="border-b border-[#EEF2F3] px-[18px] py-4">
          <div className="mb-3 flex items-center gap-2">
            <Filter size={18} className="text-petrole-600" />
            <span className="text-[12.5px] font-semibold text-ardoise">Filtres avancés</span>
            {nbFiltres > 0 && (
              <span className="rounded-full bg-petrole-100 px-2 py-0.5 font-mono text-[11px] text-petrole-600">
                {nbFiltres} actif(s)
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2.5 rounded-lg border border-[#E8EDEE] bg-surface px-3 py-2">
              <Search size={17} className="text-grisdoux" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher…"
                className="w-40 bg-transparent text-[13px] outline-none placeholder:text-grisdoux"
              />
            </div>
            <Select valeur={userId} onChange={setUserId} defaut="Employé">
              {employes.map((e) => (
                <option key={e.id} value={e.id}>{e.nom_complet}</option>
              ))}
            </Select>
            <Select valeur={categorie} onChange={(v) => setCategorie(v as Categorie | "")} defaut="Catégorie">
              {categoriesActives.map((c) => (
                <option key={c.code} value={c.code}>{c.nom}</option>
              ))}
            </Select>
            <Select valeur={statut} onChange={(v) => setStatut(v as FiltreStatut)} defaut="Statut">
              {LISTE_STATUTS.map((s) => (
                <option key={s} value={s}>{STATUTS[s].libelle}</option>
              ))}
              {/* Pseudo-statut : échéance dépassée et tâche non terminée/clôturée */}
              <option value="EN_RETARD">⚠ En retard</option>
            </Select>
            <Select valeur={priorite} onChange={(v) => setPriorite(v as Priorite | "")} defaut="Priorité">
              {LISTE_PRIORITES.map((p) => (
                <option key={p} value={p}>{PRIORITES[p].libelle}</option>
              ))}
            </Select>
            <div className="flex-1" />
            {nbFiltres > 0 && (
              <button onClick={reinitialiser} className="text-[13px] font-medium text-petrole-600">
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        {chargement && !donnees ? (
          <Spinner />
        ) : donnees && donnees.items.length === 0 ? (
          <EtatVide
            icone={SearchX}
            titre="Aucun résultat"
            description="Aucune activité ne correspond à vos critères. Essayez d'élargir la période ou de retirer un filtre."
            action={<button className="btn-secondaire" onClick={reinitialiser}>Réinitialiser les filtres</button>}
          />
        ) : vue === "tableau" ? (
          <div className="p-[18px]">
            <VueTableau
              activites={donnees!.items}
              afficherAgent
              onOuvrir={(act) =>
                navigate(`/activites/${act.id}/modifier`, {
                  state: { retour: emplacement.pathname + emplacement.search },
                })
              }
              onChange={charger}
            />
          </div>
        ) : (
          <>
            {/* En-tête figé : les intitulés de colonne restent lisibles
                quand on parcourt une longue liste. */}
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 290px)" }}>
              <table className="w-full min-w-[900px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#EEF2F3] bg-[#FAFBFB] text-left text-[11px] uppercase tracking-wide text-grisdoux [&>th]:bg-[#FAFBFB]">
                    <th className="px-[18px] py-2.5 font-semibold">Réf.</th>
                    <th className="py-2.5 font-semibold">Activité</th>
                    <th className="py-2.5 font-semibold">Employé</th>
                    <th className="py-2.5 font-semibold">Priorité</th>
                    <th className="py-2.5 font-semibold">Statut</th>
                    <th className="py-2.5 font-semibold">
                      <button onClick={basculerOrdre} className="flex items-center gap-1 text-petrole-600">
                        Date {ordre === "desc" ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
                      </button>
                    </th>
                    <th className="py-2.5 text-right font-semibold">Durée</th>
                    <th className="px-[18px] py-2.5 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {donnees!.items.map((a) => (
                    <LigneActivite key={a.id} a={a} onChange={charger} onReaffecter={() => setAReaffecter(a)} />
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

      {aReaffecter && (
        <ReassignModal
          activite={aReaffecter}
          onFermer={() => setAReaffecter(null)}
          onSucces={() => {
            setAReaffecter(null);
            charger();
          }}
        />
      )}
    </>
  );
}

function LigneActivite({
  a,
  onChange,
  onReaffecter,
}: {
  a: Activite;
  onChange: () => void;
  onReaffecter: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [enCours, setEnCours] = useState(false);
  // URL courante (filtres compris) : la page d'édition s'en sert pour revenir ici.
  const retour = location.pathname + location.search;

  async function cloturer() {
    setEnCours(true);
    try {
      await api.put(`/activites/${a.id}`, { statut: "CLOTURE" });
      onChange();
    } finally {
      setEnCours(false);
    }
  }

  return (
    <tr className="border-b border-[#F4F6F7] last:border-0 hover:bg-[#FAFBFB]">
      <td className="px-[18px] py-3 font-mono text-xs text-grisdoux">{a.reference}</td>
      <td className="max-w-0 py-3 pr-3">
        <div className="truncate text-[13px] font-medium text-encre">{a.titre}</div>
        <div className="mt-0.5"><CategorieTag categorie={a.categorie} compact /></div>
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <Avatar nom={a.user?.nom_complet ?? "?"} id={a.user_id} taille={26} />
          <span className="truncate text-[12.5px] text-ardoise">{abreger(a.user?.nom_complet)}</span>
          {a.reaffectee && (
            <span
              title={`Réaffectée${a.motif_reaffectation ? ` — ${a.motif_reaffectation}` : ""}`}
              className="flex-none rounded bg-petrole-100 px-1.5 py-0.5 text-[10px] font-semibold text-petrole-700"
            >
              ↻ réaff.
            </span>
          )}
          {a.recurrence !== "AUCUNE" && (
            <span
              title={`Tâche récurrente (${LIBELLE_RECURRENCE[a.recurrence]})`}
              className="flex-none rounded bg-[#EAE3F5] px-1.5 py-0.5 text-[10px] font-semibold text-[#7E57C2]"
            >
              ↻ {LIBELLE_RECURRENCE[a.recurrence].toLowerCase()}
            </span>
          )}
        </div>
      </td>
      <td className="py-3"><PrioriteBadge priorite={a.priorite} /></td>
      <td className="py-3">
        <div className="flex items-center gap-1.5">
          <StatutBadge statut={a.statut} />
          {a.en_retard && (
            <span className="rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">retard</span>
          )}
        </div>
      </td>
      <td className="py-3 font-mono text-[12px] text-gris">{formatDate(a.date_activite)}</td>
      <td className="py-3 text-right font-mono text-[12.5px] text-ardoise">{formatDuree(a.duree_minutes)}</td>
      <td className="px-[18px] py-3">
        <div className="flex items-center justify-end gap-2.5">
          <button
            onClick={() => navigate(`/activites/${a.id}/modifier`, { state: { retour } })}
            title="Ouvrir / modifier"
            className="text-grisdoux hover:text-petrole-600"
          >
            <Pencil size={17} />
          </button>
          {a.statut !== "CLOTURE" && (
            <button
              onClick={onReaffecter}
              title="Réaffecter à un autre agent"
              className="text-grisdoux hover:text-petrole-600"
            >
              <Repeat2 size={17} />
            </button>
          )}
          {a.statut !== "CLOTURE" ? (
            <button
              onClick={cloturer}
              disabled={enCours}
              title="Clôturer (valider) la tâche"
              className="flex items-center gap-1 rounded-md border border-[#B7DEC9] bg-succes/5 px-2 py-1 text-[11.5px] font-medium text-succes hover:bg-succes/10 disabled:opacity-50"
            >
              {enCours ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Clôturer
            </button>
          ) : (
            <span className="text-[11.5px] font-medium text-succes">✓ Clôturée</span>
          )}
        </div>
      </td>
    </tr>
  );
}

function abreger(nom?: string | null): string {
  if (!nom) return "—";
  const parties = nom.split(" ");
  return parties.length > 1 ? `${parties[0][0]}. ${parties[parties.length - 1]}` : nom;
}

function Select({
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
