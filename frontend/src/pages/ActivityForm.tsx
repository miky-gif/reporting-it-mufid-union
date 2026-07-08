import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Lightbulb, Loader2, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { api, messageErreur } from "@/lib/api";
import { LISTE_PRIORITES, LISTE_STATUTS_EMPLOYE, PRIORITES, STATUTS } from "@/lib/constants";
import { useCategories } from "@/context/CategoriesContext";
import { isoDate } from "@/lib/format";
import type { Activite, Categorie, Priorite, Statut } from "@/types";
import { CategorieTag, PrioriteBadge, StatutBadge } from "@/components/ui/Badges";
import { EnteteSection, Spinner } from "@/components/ui/Divers";

const schema = z.object({
  categorie: z.string().min(1, "La catégorie est requise."),
  titre: z.string().min(2, "La rubrique est requise.").max(200), // stocke la rubrique choisie
  description: z.string().max(2000).optional(),
  livrable: z.string().max(1000).optional(),
  activites_a_mener: z.string().max(1000).optional(),
  priorite: z.enum(LISTE_PRIORITES as [Priorite, ...Priorite[]]),
  statut: z.enum(["A_FAIRE", "EN_COURS", "TERMINE", "BLOQUE"] as [Statut, ...Statut[]]),
  date_activite: z.string().min(1, "La date est requise."),
  duree_heures: z.coerce.number().min(0, "Durée invalide.").max(24, "Maximum 24 h."),
});
type FormValues = z.infer<typeof schema>;

export default function ActivityForm() {
  const { id } = useParams();
  const editionId = id ? Number(id) : null;
  const navigate = useNavigate();
  const { actives, rubriquesOf, chargement: catChargement } = useCategories();
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargementInitial, setChargementInitial] = useState(!!editionId);
  const [initFait, setInitFait] = useState(false);
  // Tâche affectée par l'admin : l'employé ne peut en changer que le statut.
  const [verrouille, setVerrouille] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categorie: "",
      titre: "",
      description: "",
      livrable: "",
      activites_a_mener: "",
      priorite: "MOYENNE",
      statut: "EN_COURS",
      date_activite: isoDate(new Date()),
      duree_heures: 1,
    },
  });

  const val = watch();

  useEffect(() => {
    if (!editionId) return;
    api
      .get<Activite>(`/activites/${editionId}`)
      .then((r) => {
        const a = r.data;
        reset({
          categorie: a.categorie,
          titre: a.titre,
          description: a.description ?? "",
          livrable: a.livrable ?? "",
          activites_a_mener: a.activites_a_mener ?? "",
          priorite: a.priorite,
          statut: a.statut,
          date_activite: a.date_activite,
          duree_heures: a.duree_heures,
        });
        setVerrouille(a.assignee_par_admin);
        setInitFait(true);
      })
      .catch(() => setErreur("Activité introuvable."))
      .finally(() => setChargementInitial(false));
  }, [editionId, reset]);

  // Création : initialise catégorie + rubrique dès que les catégories sont chargées.
  useEffect(() => {
    if (editionId || initFait || catChargement || actives.length === 0) return;
    const cat = actives[0];
    setValue("categorie", cat.code);
    setValue("titre", cat.rubriques[0] ?? "");
    setInitFait(true);
  }, [editionId, initFait, catChargement, actives, setValue]);

  // Rubriques disponibles pour la catégorie courante (+ la valeur existante si hors liste).
  const rubriques = useMemo(() => {
    const base = rubriquesOf(val.categorie);
    if (val.titre && !base.includes(val.titre)) return [val.titre, ...base];
    return base;
  }, [val.categorie, val.titre, rubriquesOf]);

  // Statuts proposés : « À faire » réservé à l'admin ; on l'affiche seulement s'il
  // s'agit d'une tâche déjà « À faire » (affectée par l'admin) que l'on modifie.
  const statutsDisponibles = useMemo<Statut[]>(() => {
    if (editionId && val.statut === "A_FAIRE") return ["A_FAIRE", ...LISTE_STATUTS_EMPLOYE];
    return LISTE_STATUTS_EMPLOYE;
  }, [editionId, val.statut]);

  // Quand la catégorie change, on cale la rubrique sur une valeur valide.
  function changerCategorie(cat: Categorie) {
    setValue("categorie", cat);
    const rubs = rubriquesOf(cat);
    if (!rubs.includes(val.titre)) setValue("titre", rubs[0] ?? "");
  }

  async function soumettre(valeurs: FormValues) {
    setErreur(null);
    try {
      if (editionId) {
        // Tâche affectée : seul le statut est modifiable côté employé.
        await api.put(`/activites/${editionId}`, verrouille ? { statut: valeurs.statut } : valeurs);
      } else {
        await api.post("/activites", valeurs);
      }
      navigate("/activites");
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    }
  }

  if (chargementInitial || (!editionId && catChargement)) return <Spinner />;

  return (
    <>
      <Link to="/activites" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gris hover:text-ardoise">
        <ArrowLeft size={17} /> Retour à mes activités
      </Link>
      <EnteteSection
        titre={editionId ? "Modifier l'activité" : "Nouvelle activité"}
        sousTitre="Renseignez les informations de la tâche réalisée ou planifiée."
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
          {erreur}
        </div>
      )}

      {verrouille && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#DCE9ED] bg-petrole-50 px-3 py-2.5 text-[13px] text-ardoise">
          <Lock size={16} className="mt-0.5 flex-none text-petrole-600" />
          <span>
            Cette tâche vous a été <strong>affectée par un administrateur</strong>. Vous pouvez uniquement en
            mettre à jour le <strong>statut</strong> ; les autres champs sont en lecture seule.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(soumettre)} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="carte p-[26px_28px]">
          {/* Catégorie — premier champ */}
          <Champ label="Catégorie" requis erreur={errors.categorie?.message}>
            <select className="champ" value={val.categorie} disabled={verrouille} onChange={(e) => changerCategorie(e.target.value)}>
              {actives.map((c) => (
                <option key={c.code} value={c.code}>{c.nom}</option>
              ))}
            </select>
          </Champ>

          {/* Rubrique — dépend de la catégorie, remplace le titre */}
          <Champ label="Rubrique" requis erreur={errors.titre?.message}>
            <select className="champ" disabled={verrouille} {...register("titre")}>
              {rubriques.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Champ>

          <Champ label="Description de l'activité">
            <textarea
              rows={3}
              className="champ resize-y"
              disabled={verrouille}
              placeholder="Détaillez les actions menées, une par ligne (repris en puces dans le rapport)…"
              {...register("description")}
            />
          </Champ>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Résultat obtenu (livrable)">
              <textarea
                rows={2}
                className="champ resize-y"
                disabled={verrouille}
                placeholder="Ex. Fichier des incidents, rapport produit…"
                {...register("livrable")}
              />
            </Champ>
            <Champ label="Activités à mener (semaine suivante)">
              <textarea
                rows={2}
                className="champ resize-y"
                disabled={verrouille}
                placeholder="Ce qu'il reste à faire / prochaines étapes…"
                {...register("activites_a_mener")}
              />
            </Champ>
          </div>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Durée (heures)" requis erreur={errors.duree_heures?.message}>
              <input type="number" step="0.5" min="0" className="champ font-mono" disabled={verrouille} {...register("duree_heures")} />
            </Champ>
            <Champ label="Date" requis erreur={errors.date_activite?.message}>
              <input type="date" className="champ font-mono" disabled={verrouille} {...register("date_activite")} />
            </Champ>
          </div>

          <Champ label="Priorité" requis>
            <div className="flex flex-wrap gap-2">
              {LISTE_PRIORITES.map((p) => (
                <BoutonChoix key={p} actif={val.priorite === p} disabled={verrouille} couleur={PRIORITES[p].couleur} fond={PRIORITES[p].fond} onClick={() => setValue("priorite", p)}>
                  {PRIORITES[p].libelle}
                </BoutonChoix>
              ))}
            </div>
          </Champ>

          <Champ label="Statut" requis>
            <div className="flex flex-wrap gap-2">
              {statutsDisponibles.map((s) => (
                <BoutonChoix key={s} actif={val.statut === s} couleur={STATUTS[s].couleur} fond={STATUTS[s].fond} onClick={() => setValue("statut", s)}>
                  {STATUTS[s].libelle}
                </BoutonChoix>
              ))}
            </div>
          </Champ>

          <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F3] pt-5">
            <button type="button" onClick={() => navigate(-1)} className="btn-fantome">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="btn-primaire">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {editionId ? "Enregistrer les modifications" : "Enregistrer l'activité"}
            </button>
          </div>
        </div>

        {/* Colonne d'aperçu + conseils */}
        <div className="flex flex-col gap-4">
          <div className="carte p-[18px_20px]">
            <div className="mb-3.5 text-xs font-semibold uppercase tracking-wide text-grisdoux">Aperçu</div>
            <div className="mb-3 text-[14.5px] font-semibold leading-snug text-encre">{val.titre || "Rubrique"}</div>
            <div className="mb-3.5 flex flex-wrap gap-2">
              <CategorieTag categorie={val.categorie} />
              <PrioriteBadge priorite={val.priorite} />
              <StatutBadge statut={val.statut} />
            </div>
            <div className="flex items-center justify-between border-t border-[#EEF2F3] pt-3">
              <span className="text-[12.5px] text-grisdoux">
                {val.date_activite ? val.date_activite.split("-").reverse().join("/") : "—"}
              </span>
              <span className="font-mono text-[13px] font-semibold text-petrole-600">
                {String(val.duree_heures ?? 0).replace(".", ",")} h
              </span>
            </div>
          </div>

          <div className="rounded-xl2 border border-[#DCE9ED] bg-petrole-50 p-[18px_20px]">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb size={19} className="text-petrole-600" />
              <span className="text-[13px] font-semibold text-petrole-600">Bonnes pratiques</span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {[
                "Choisissez d'abord la catégorie, puis la rubrique adaptée.",
                "Renseignez la durée réelle passée.",
                "Détaillez le contexte dans la description.",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-[12.5px] leading-snug text-ardoise">
                  <Check size={17} className="flex-none text-succes" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>
    </>
  );
}

function Champ({
  label,
  requis,
  erreur,
  children,
}: {
  label: string;
  requis?: boolean;
  erreur?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[18px]">
      <label className="label">
        {label} {requis && <span className="text-danger">*</span>}
      </label>
      {children}
      {erreur && <p className="mt-1 text-[12px] text-danger">{erreur}</p>}
    </div>
  );
}

function BoutonChoix({
  actif,
  couleur,
  fond,
  onClick,
  disabled,
  children,
}: {
  actif: boolean;
  couleur: string;
  fond: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onClick()}
      className={"flex-1 rounded-lg border px-3 py-2.5 text-[12.5px] font-medium transition " + (disabled ? "cursor-not-allowed opacity-60" : "")}
      style={
        actif
          ? { borderColor: couleur, color: couleur, background: fond, borderWidth: 1.5 }
          : { borderColor: "#CDD8DC", color: "#5E717B", background: "#fff" }
      }
    >
      {children}
    </button>
  );
}
