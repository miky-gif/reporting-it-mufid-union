import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Lightbulb, Loader2, Lock, Repeat, Repeat2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { api, messageErreur } from "@/lib/api";
import { LIBELLE_RECURRENCE, LISTE_PRIORITES, LISTE_STATUTS, LISTE_STATUTS_EMPLOYE, POURCENTAGE_PAR_STATUT, PRIORITES, RECURRENCES, STATUTS } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { useCategories } from "@/context/CategoriesContext";
import { formatDuree, isoDate } from "@/lib/format";
import type { Activite, Categorie, Priorite, Statut } from "@/types";
import { CategorieTag, PrioriteBadge, StatutBadge } from "@/components/ui/Badges";
import { EnteteSection, Spinner } from "@/components/ui/Divers";
import { PiecesJointes, televerserEnAttente } from "@/components/ui/PiecesJointes";

const schema = z.object({
  categorie: z.string().min(1, "La catégorie est requise."),
  titre: z.string().min(2, "La rubrique est requise.").max(200), // stocke la rubrique choisie
  consignes: z.string().max(2000).optional(), // consigne de départ (admin uniquement)
  description: z.string().max(2000).optional(), // état d'exécution
  livrable: z.string().max(1000).optional(),
  activites_a_mener: z.string().max(1000).optional(),
  priorite: z.enum(LISTE_PRIORITES as [Priorite, ...Priorite[]]),
  statut: z.enum(["A_FAIRE", "EN_COURS", "STANDBY", "TERMINE", "CLOTURE"] as [Statut, ...Statut[]]),
  pourcentage: z.coerce.number().int().min(0, "Entre 0 et 100.").max(100, "Entre 0 et 100."),
  date_debut: z.string().min(1, "La date de début est requise."),
  date_fin: z.string().min(1, "La date de fin est requise."),
  duree_minutes: z.coerce.number().int().min(1, "Durée requise (min. 1 minute).").max(1440, "Maximum 24 h."),
  recurrence: z.enum(["AUCUNE", "JOUR", "SEMAINE", "MOIS"]).default("AUCUNE"),
  recurrence_fin: z.string().optional(),
}).refine((d) => !d.date_debut || !d.date_fin || d.date_fin >= d.date_debut, {
  message: "La date de fin doit être postérieure ou égale à la date de début.",
  path: ["date_fin"],
});
type FormValues = z.infer<typeof schema>;

export default function ActivityForm() {
  const { id } = useParams();
  const editionId = id ? Number(id) : null;
  const navigate = useNavigate();
  const { estAdmin } = useAuth();
  const { actives, rubriquesOf, chargement: catChargement } = useCategories();
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargementInitial, setChargementInitial] = useState(!!editionId);
  const [initFait, setInitFait] = useState(false);
  // Tâche affectée par l'admin : l'EMPLOYÉ ne peut en changer que le statut/l'état.
  // L'admin, lui, garde la main sur tout (durée, période, consignes, statut…).
  const [assignee, setAssignee] = useState(false);
  const [consignes, setConsignes] = useState<string | null>(null);
  const [pending, setPending] = useState<File[]>([]);
  // Trace de réaffectation (motif + date), affichée sur la tâche.
  const [reaff, setReaff] = useState<{ motif: string | null; date: string | null } | null>(null);

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
      consignes: "",
      description: "",
      livrable: "",
      activites_a_mener: "",
      priorite: "MOYENNE",
      statut: "EN_COURS",
      pourcentage: POURCENTAGE_PAR_STATUT.EN_COURS,
      date_debut: isoDate(new Date()),
      date_fin: isoDate(new Date()),
      duree_minutes: 60,
      recurrence: "AUCUNE",
      recurrence_fin: "",
    },
  });

  // Saisie de la durée : valeur + unité (minutes ou heures) -> duree_minutes.
  const [unite, setUnite] = useState<"MIN" | "H">("H");
  const [dureeSaisie, setDureeSaisie] = useState("1");

  useEffect(() => {
    const v = parseFloat(dureeSaisie.replace(",", "."));
    if (!Number.isNaN(v) && v > 0) {
      setValue("duree_minutes", Math.round(unite === "H" ? v * 60 : v), { shouldValidate: true });
    }
  }, [dureeSaisie, unite, setValue]);

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
          consignes: a.consignes ?? "",
          description: a.description ?? "",
          livrable: a.livrable ?? "",
          activites_a_mener: a.activites_a_mener ?? "",
          priorite: a.priorite,
          statut: a.statut,
          pourcentage: a.pourcentage,
          date_debut: a.date_debut ?? a.date_activite,
          date_fin: a.date_fin ?? a.date_activite,
          duree_minutes: a.duree_minutes,
          recurrence: a.recurrence ?? "AUCUNE",
          recurrence_fin: a.recurrence_fin ?? "",
        });
        // Réaffiche la durée dans l'unité la plus lisible (heures si multiple de 60).
        if (a.duree_minutes >= 60 && a.duree_minutes % 60 === 0) {
          setUnite("H");
          setDureeSaisie(String(a.duree_minutes / 60));
        } else {
          setUnite("MIN");
          setDureeSaisie(String(a.duree_minutes));
        }
        setAssignee(a.assignee_par_admin);
        setConsignes(a.consignes ?? null);
        setReaff(a.reaffectee ? { motif: a.motif_reaffectation, date: a.date_reaffectation } : null);
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
    if (estAdmin) return LISTE_STATUTS; // l'admin dispose de tous les statuts (dont Clôturé)
    if (editionId && val.statut === "CLOTURE") return ["CLOTURE"]; // clôturé par l'admin
    if (editionId && val.statut === "A_FAIRE") return ["A_FAIRE", ...LISTE_STATUTS_EMPLOYE];
    return LISTE_STATUTS_EMPLOYE;
  }, [estAdmin, editionId, val.statut]);

  // Règles de verrouillage — l'admin garde TOUJOURS la main sur tout.
  // • verrouille : cadrage (catégorie, rubrique, priorité, durée, période, consignes)
  // • gel        : tâche clôturée -> lecture seule (pour l'employé uniquement)
  const verrouille = !estAdmin && assignee;
  const gel = !estAdmin && val.statut === "CLOTURE";
  const retour = estAdmin ? "/admin/activites" : "/activites";

  // Quand la catégorie change, on cale la rubrique sur une valeur valide.
  function changerCategorie(cat: Categorie) {
    setValue("categorie", cat);
    const rubs = rubriquesOf(cat);
    if (!rubs.includes(val.titre)) setValue("titre", rubs[0] ?? "");
  }

  async function soumettre(valeurs: FormValues) {
    setErreur(null);
    const corps = {
      ...valeurs,
      recurrence_fin: valeurs.recurrence !== "AUCUNE" && valeurs.recurrence_fin ? valeurs.recurrence_fin : undefined,
    };
    try {
      if (editionId) {
        // Le backend applique les règles de périmètre (état/statut si affectée).
        await api.put(`/activites/${editionId}`, corps);
      } else {
        const r = await api.post<Activite>("/activites", corps);
        if (pending.length) await televerserEnAttente(r.data.id, pending);
      }
      navigate(retour);
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    }
  }

  if (chargementInitial || (!editionId && catChargement)) return <Spinner />;

  return (
    <>
      <Link to={retour} className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gris hover:text-ardoise">
        <ArrowLeft size={17} /> {estAdmin ? "Retour à la gestion des activités" : "Retour à mes activités"}
      </Link>
      <EnteteSection
        titre={editionId ? "Modifier l'activité" : "Nouvelle activité"}
        sousTitre={
          estAdmin
            ? "En tant qu'administrateur, vous pouvez ajuster tous les champs (durée, période, statut, consignes)."
            : "Renseignez les informations de la tâche réalisée ou planifiée."
        }
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
            Cette tâche vous a été <strong>affectée par un administrateur</strong>. Vous pouvez mettre à jour
            l'<strong>état d'exécution</strong> et le <strong>statut</strong> ; le cadrage (catégorie, rubrique,
            priorité, durée, consignes) reste en lecture seule.
          </span>
        </div>
      )}
      {gel && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#B7DEC9] bg-succes/5 px-3 py-2.5 text-[13px] text-succes">
          <Lock size={16} className="mt-0.5 flex-none" />
          <span>Cette tâche a été <strong>clôturée par l'administrateur</strong> : elle n'est plus modifiable.</span>
        </div>
      )}

      <form onSubmit={handleSubmit(soumettre)} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="carte p-[26px_28px]">
          {/* Tâche reprise d'un autre agent : motif de la réaffectation */}
          {reaff && (
            <div className="mb-[18px] rounded-lg border border-[#DCE9ED] bg-surface px-3.5 py-3">
              <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-petrole-600">
                <Repeat2 size={14} /> Tâche réaffectée
                {reaff.date && (
                  <span className="font-normal normal-case tracking-normal text-grisdoux">
                    · le {new Date(reaff.date).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
              <div className="text-[13px] leading-snug text-ardoise">
                <span className="text-grisdoux">Motif : </span>
                {reaff.motif ? (
                  <span className="whitespace-pre-wrap font-medium">{reaff.motif}</span>
                ) : (
                  <span className="italic text-grisdoux">non précisé</span>
                )}
              </div>
            </div>
          )}

          {/* Consigne de départ : modifiable par l'admin, lecture seule pour l'IT */}
          {estAdmin ? (
            <Champ label="Consigne de départ">
              <textarea
                rows={2}
                className="champ resize-y"
                placeholder="Instructions / attentes pour l'agent (non modifiables par lui)…"
                {...register("consignes")}
              />
            </Champ>
          ) : (
            consignes && (
              <div className="mb-[18px] rounded-lg border border-[#DCE9ED] bg-petrole-50 px-3.5 py-3">
                <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-petrole-600">
                  Consigne de départ (administrateur)
                </div>
                <div className="whitespace-pre-wrap text-[13px] leading-snug text-ardoise">{consignes}</div>
              </div>
            )
          )}

          {/* Catégorie — premier champ */}
          <Champ label="Catégorie" requis erreur={errors.categorie?.message}>
            <select className="champ" value={val.categorie} disabled={verrouille || gel} onChange={(e) => changerCategorie(e.target.value)}>
              {actives.map((c) => (
                <option key={c.code} value={c.code}>{c.nom}</option>
              ))}
            </select>
          </Champ>

          {/* Rubrique — dépend de la catégorie, remplace le titre */}
          <Champ label="Rubrique" requis erreur={errors.titre?.message}>
            <select className="champ" disabled={verrouille || gel} {...register("titre")}>
              {rubriques.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Champ>

          <Champ label="État d'exécution de l'activité">
            <textarea
              rows={3}
              className="champ resize-y"
              disabled={gel}
              placeholder="Détaillez les actions menées, une par ligne (repris en puces dans le rapport)…"
              {...register("description")}
            />
          </Champ>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Résultat attendu (livrable)">
              <textarea
                rows={2}
                className="champ resize-y"
                disabled={gel}
                placeholder="Ex. Fichier des incidents, rapport produit…"
                {...register("livrable")}
              />
            </Champ>
            <Champ label="Activités à mener (semaine suivante)">
              <textarea
                rows={2}
                className="champ resize-y"
                disabled={gel}
                placeholder="Ce qu'il reste à faire / prochaines étapes…"
                {...register("activites_a_mener")}
              />
            </Champ>
          </div>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Champ label="Début" requis erreur={errors.date_debut?.message}>
              <input type="date" className="champ font-mono" disabled={verrouille || gel} {...register("date_debut")} />
            </Champ>
            <Champ label="Fin (échéance)" requis erreur={errors.date_fin?.message}>
              <input type="date" className="champ font-mono" disabled={verrouille || gel} {...register("date_fin")} />
            </Champ>
            <Champ label="Durée" requis erreur={errors.duree_minutes?.message}>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={unite === "H" ? "0.25" : "1"}
                  min="0"
                  className="champ flex-1 font-mono"
                  disabled={verrouille || gel}
                  value={dureeSaisie}
                  onChange={(e) => setDureeSaisie(e.target.value)}
                />
                <select
                  className="champ w-[104px]"
                  disabled={verrouille || gel}
                  value={unite}
                  onChange={(e) => setUnite(e.target.value as "MIN" | "H")}
                >
                  <option value="MIN">minutes</option>
                  <option value="H">heures</option>
                </select>
              </div>
              <p className="mt-1 text-[11.5px] text-grisdoux">= {formatDuree(val.duree_minutes ?? 0)}</p>
            </Champ>
          </div>

          {/* Récurrence : régénère automatiquement la tâche (verrouillée si tâche affectée) */}
          <div className="mb-[18px] rounded-lg border border-[#DCE9ED] bg-petrole-50/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-petrole-600">
              <Repeat size={15} /> Récurrence
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Fréquence">
                <select className="champ" disabled={verrouille || gel} {...register("recurrence")}>
                  {RECURRENCES.map((r) => (
                    <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                  ))}
                </select>
              </Champ>
              {val.recurrence !== "AUCUNE" && (
                <Champ label="Fin de récurrence (facultatif)">
                  <input type="date" className="champ font-mono" min={val.date_debut} disabled={verrouille || gel} {...register("recurrence_fin")} />
                </Champ>
              )}
            </div>
            {val.recurrence !== "AUCUNE" && (
              <p className="mt-1.5 text-[11.5px] text-grisdoux">
                Une nouvelle occurrence sera créée automatiquement ({LIBELLE_RECURRENCE[val.recurrence].toLowerCase()}), avec
                notification par e-mail à chaque fois.
              </p>
            )}
          </div>

          <Champ label="Priorité" requis>
            <div className="flex flex-wrap gap-2">
              {LISTE_PRIORITES.map((p) => (
                <BoutonChoix key={p} actif={val.priorite === p} disabled={verrouille || gel} couleur={PRIORITES[p].couleur} fond={PRIORITES[p].fond} onClick={() => setValue("priorite", p)}>
                  {PRIORITES[p].libelle}
                </BoutonChoix>
              ))}
            </div>
          </Champ>

          <Champ label="Statut" requis>
            <div className="flex flex-wrap gap-2">
              {statutsDisponibles.map((s) => (
                <BoutonChoix
                  key={s}
                  actif={val.statut === s}
                  disabled={gel}
                  couleur={STATUTS[s].couleur}
                  fond={STATUTS[s].fond}
                  onClick={() => {
                    setValue("statut", s);
                    // Pré-remplit le % selon le statut ; reste ajustable à la main.
                    setValue("pourcentage", POURCENTAGE_PAR_STATUT[s]);
                  }}
                >
                  {STATUTS[s].libelle}
                </BoutonChoix>
              ))}
            </div>
          </Champ>

          <Champ label="% réalisation" requis erreur={errors.pourcentage?.message}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                className="flex-1 accent-[#0E5E7C]"
                disabled={gel}
                value={val.pourcentage ?? 0}
                onChange={(e) => setValue("pourcentage", Number(e.target.value))}
              />
              <input
                type="number"
                min="0"
                max="100"
                className="champ w-[86px] font-mono"
                disabled={gel}
                {...register("pourcentage")}
              />
              <span className="text-[13px] font-semibold text-petrole-600">%</span>
            </div>
          </Champ>

          <div className="mt-[18px] border-t border-[#EEF2F3] pt-[18px]">
            <PiecesJointes activiteId={editionId} pending={pending} onPendingChange={setPending} />
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-[#EEF2F3] pt-5">
            <button type="button" onClick={() => navigate(-1)} className="btn-fantome">Annuler</button>
            <button type="submit" disabled={isSubmitting || gel} className="btn-primaire">
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
              <span className="text-[12px] text-grisdoux">
                {val.date_debut && val.date_fin
                  ? `du ${jjmm(val.date_debut)} au ${jjmm(val.date_fin)}`
                  : "—"}
              </span>
              <span className="font-mono text-[13px] font-semibold text-petrole-600">
                {formatDuree(val.duree_minutes ?? 0)}
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

function jjmm(iso: string): string {
  const [, m, j] = iso.split("-");
  return j && m ? `${j}/${m}` : iso;
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
