import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Loader2, Repeat, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api, messageErreur } from "@/lib/api";
import { LIBELLE_RECURRENCE, LISTE_PRIORITES, LISTE_STATUTS_ADMIN, POURCENTAGE_PAR_STATUT, PRIORITES, RECURRENCES, STATUTS } from "@/lib/constants";
import { useCategories } from "@/context/CategoriesContext";
import { formatDuree, isoDate } from "@/lib/format";
import type { Activite, Categorie, Priorite, Statut, UserWithStats } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { CategorieTag, PrioriteBadge, StatutBadge } from "@/components/ui/Badges";
import { EnteteSection, Spinner } from "@/components/ui/Divers";
import { PiecesJointes, televerserEnAttente } from "@/components/ui/PiecesJointes";

const schema = z.object({
  categorie: z.string().min(1, "La catégorie est requise."),
  titre: z.string().min(2, "La rubrique est requise.").max(200),
  consignes: z.string().max(2000).optional(), // consigne de départ
  description: z.string().max(2000).optional(), // état d'exécution (facultatif à l'affectation)
  livrable: z.string().max(1000).optional(),
  activites_a_mener: z.string().max(1000).optional(),
  priorite: z.enum(LISTE_PRIORITES as [Priorite, ...Priorite[]]),
  statut: z.enum(LISTE_STATUTS_ADMIN as [Statut, ...Statut[]]),
  pourcentage: z.coerce.number().int().min(0, "Entre 0 et 100.").max(100, "Entre 0 et 100."),
  date_debut: z.string().min(1, "La date de début est requise."),
  date_fin: z.string().min(1, "La date de fin est requise."),
  duree_minutes: z.coerce.number().int().min(1, "Durée requise (en minutes).").max(1440),
  recurrence: z.enum(["AUCUNE", "JOUR", "SEMAINE", "MOIS"]).default("AUCUNE"),
  recurrence_fin: z.string().optional(),
}).refine((d) => !d.date_debut || !d.date_fin || d.date_fin >= d.date_debut, {
  message: "La date de fin doit être postérieure ou égale à la date de début.",
  path: ["date_fin"],
});
type FormValues = z.infer<typeof schema>;

export default function AdminTaskForm() {
  const navigate = useNavigate();
  const { actives, rubriquesOf, chargement: catChargement } = useCategories();
  const [employes, setEmployes] = useState<UserWithStats[] | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [pending, setPending] = useState<File[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
      statut: "A_FAIRE",
      pourcentage: POURCENTAGE_PAR_STATUT.A_FAIRE,
      date_debut: isoDate(new Date()),
      date_fin: isoDate(new Date()),
      duree_minutes: 60,
      recurrence: "AUCUNE",
      recurrence_fin: "",
    },
  });
  const val = watch();

  // Saisie de la durée : valeur + unité (minutes ou heures) -> duree_minutes.
  const [unite, setUnite] = useState<"MIN" | "H">("H");
  const [dureeSaisie, setDureeSaisie] = useState("1");

  useEffect(() => {
    const v = parseFloat(dureeSaisie.replace(",", "."));
    if (!Number.isNaN(v) && v > 0) {
      setValue("duree_minutes", Math.round(unite === "H" ? v * 60 : v), { shouldValidate: true });
    }
  }, [dureeSaisie, unite, setValue]);

  useEffect(() => {
    api.get<UserWithStats[]>("/users").then((r) => {
      setEmployes(r.data.filter((u) => u.actif && u.role === "EMPLOYE"));
    });
  }, []);

  useEffect(() => {
    if (val.categorie || catChargement || actives.length === 0) return;
    setValue("categorie", actives[0].code);
    setValue("titre", actives[0].rubriques[0] ?? "");
  }, [val.categorie, catChargement, actives, setValue]);

  const rubriques = useMemo(() => rubriquesOf(val.categorie), [val.categorie, rubriquesOf]);

  function changerCategorie(cat: Categorie) {
    setValue("categorie", cat);
    const rubs = rubriquesOf(cat);
    if (!rubs.includes(val.titre)) setValue("titre", rubs[0] ?? "");
  }

  function basculer(id: number) {
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function soumettre(valeurs: FormValues) {
    setErreur(null);
    if (selection.length === 0) {
      setErreur("Sélectionnez au moins un agent à qui affecter la tâche.");
      return;
    }
    try {
      const corps = {
        ...valeurs,
        user_ids: selection,
        // La date de fin de récurrence n'a de sens que si une récurrence est active.
        recurrence_fin: valeurs.recurrence !== "AUCUNE" && valeurs.recurrence_fin ? valeurs.recurrence_fin : undefined,
      };
      const r = await api.post<Activite>("/activites", corps);
      if (pending.length) await televerserEnAttente(r.data.id, pending);
      setSucces(true);
      setTimeout(() => navigate("/admin/activites"), 1200);
    } catch (err) {
      setErreur(messageErreur(err, "Affectation impossible."));
    }
  }

  if (!employes) return <Spinner />;

  return (
    <>
      <Link to="/admin/activites" className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-gris hover:text-ardoise">
        <ArrowLeft size={17} /> Retour à la gestion des activités
      </Link>
      <EnteteSection
        titre="Affecter une tâche"
        sousTitre="Créez une tâche et attribuez-la à un ou plusieurs agents. Chacun sera notifié (plateforme + e-mail)."
      />

      {succes && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#B7DEC9] bg-succes/5 px-3 py-2.5 text-[13px] text-succes">
          <Check size={17} /> Tâche affectée à {selection.length} agent(s). Notification envoyée.
        </div>
      )}
      {erreur && (
        <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
          {erreur}
        </div>
      )}

      <form onSubmit={handleSubmit(soumettre)} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="carte p-[26px_28px]">
          {/* Sélection multiple d'agents */}
          <Champ label={`Agents affectés (${selection.length} sélectionné${selection.length > 1 ? "s" : ""})`} requis>
            <div className="max-h-[190px] overflow-y-auto rounded-lg border border-bordure">
              {employes.map((e) => (
                <label
                  key={e.id}
                  className={
                    "flex cursor-pointer items-center gap-2.5 border-b border-[#F4F6F7] px-3 py-2 last:border-0 hover:bg-surface " +
                    (selection.includes(e.id) ? "bg-petrole-50/60" : "")
                  }
                >
                  <input type="checkbox" checked={selection.includes(e.id)} onChange={() => basculer(e.id)} />
                  <Avatar nom={e.nom_complet} id={e.id} taille={26} />
                  <span className="text-[13px] font-medium text-encre">{e.nom_complet}</span>
                  <span className="ml-auto text-[11.5px] text-grisdoux">{e.poste}</span>
                </label>
              ))}
              {employes.length === 0 && (
                <div className="px-3 py-4 text-center text-[12.5px] text-grisdoux">Aucun agent actif.</div>
              )}
            </div>
          </Champ>

          <Champ label="Catégorie" requis erreur={errors.categorie?.message}>
            <select className="champ" value={val.categorie} onChange={(e) => changerCategorie(e.target.value)}>
              {actives.map((c) => (
                <option key={c.code} value={c.code}>{c.nom}</option>
              ))}
            </select>
          </Champ>

          <Champ label="Rubrique" requis erreur={errors.titre?.message}>
            <select className="champ" {...register("titre")}>
              {rubriques.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Champ>

          <Champ label="Consigne de départ">
            <textarea rows={3} className="champ resize-y" placeholder="Instructions / attentes pour l'agent (non modifiable par l'agent)…" {...register("consignes")} />
          </Champ>

          <Champ label="État d'exécution (facultatif)">
            <textarea rows={2} className="champ resize-y" placeholder="À laisser vide en général : l'agent le renseignera." {...register("description")} />
          </Champ>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Résultat attendu (livrable)">
              <textarea rows={2} className="champ resize-y" placeholder="Ex. Fichier des incidents, rapport produit…" {...register("livrable")} />
            </Champ>
            <Champ label="Activités à mener (semaine suivante)">
              <textarea rows={2} className="champ resize-y" placeholder="Prochaines étapes / suite à donner…" {...register("activites_a_mener")} />
            </Champ>
          </div>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Champ label="Début" requis erreur={errors.date_debut?.message}>
              <input type="date" className="champ font-mono" {...register("date_debut")} />
            </Champ>
            <Champ label="Fin (échéance)" requis erreur={errors.date_fin?.message}>
              <input type="date" className="champ font-mono" {...register("date_fin")} />
            </Champ>
            <Champ label="Durée estimée" requis erreur={errors.duree_minutes?.message}>
              <div className="flex gap-2">
                <input
                  type="number"
                  step={unite === "H" ? "0.25" : "1"}
                  min="0"
                  className="champ flex-1 font-mono"
                  value={dureeSaisie}
                  onChange={(e) => setDureeSaisie(e.target.value)}
                />
                <select className="champ w-[104px]" value={unite} onChange={(e) => setUnite(e.target.value as "MIN" | "H")}>
                  <option value="MIN">minutes</option>
                  <option value="H">heures</option>
                </select>
              </div>
              <p className="mt-1 text-[11.5px] text-grisdoux">= {formatDuree(val.duree_minutes ?? 0)}</p>
            </Champ>
          </div>

          {/* Récurrence : régénère automatiquement la tâche + notifie à chaque fois */}
          <div className="mb-[18px] rounded-lg border border-[#DCE9ED] bg-petrole-50/50 p-3.5">
            <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-petrole-600">
              <Repeat size={15} /> Récurrence
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Fréquence">
                <select className="champ" {...register("recurrence")}>
                  {RECURRENCES.map((r) => (
                    <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                  ))}
                </select>
              </Champ>
              {val.recurrence !== "AUCUNE" && (
                <Champ label="Fin de récurrence (facultatif)">
                  <input type="date" className="champ font-mono" min={val.date_debut} {...register("recurrence_fin")} />
                </Champ>
              )}
            </div>
            {val.recurrence !== "AUCUNE" && (
              <p className="mt-1.5 text-[11.5px] text-grisdoux">
                Une nouvelle occurrence sera créée automatiquement ({LIBELLE_RECURRENCE[val.recurrence].toLowerCase()}) et
                l'agent sera notifié par e-mail à chaque fois{val.recurrence_fin ? `, jusqu'au ${val.recurrence_fin.split("-").reverse().join("/")}` : " (sans date de fin)"}.
              </p>
            )}
          </div>

          <Champ label="Priorité" requis>
            <div className="flex flex-wrap gap-2">
              {LISTE_PRIORITES.map((p) => (
                <BoutonChoix key={p} actif={val.priorite === p} couleur={PRIORITES[p].couleur} fond={PRIORITES[p].fond} onClick={() => setValue("priorite", p)}>
                  {PRIORITES[p].libelle}
                </BoutonChoix>
              ))}
            </div>
          </Champ>

          <Champ label="Statut initial" requis>
            <div className="flex flex-wrap gap-2">
              {LISTE_STATUTS_ADMIN.map((s) => (
                <BoutonChoix
                  key={s}
                  actif={val.statut === s}
                  couleur={STATUTS[s].couleur}
                  fond={STATUTS[s].fond}
                  onClick={() => {
                    setValue("statut", s);
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
                value={val.pourcentage ?? 0}
                onChange={(e) => setValue("pourcentage", Number(e.target.value))}
              />
              <input type="number" min="0" max="100" className="champ w-[86px] font-mono" {...register("pourcentage")} />
              <span className="text-[13px] font-semibold text-petrole-600">%</span>
            </div>
          </Champ>

          <div className="mt-[18px] border-t border-[#EEF2F3] pt-[18px]">
            <PiecesJointes activiteId={null} pending={pending} onPendingChange={setPending} />
          </div>

          <div className="mt-5 flex items-center justify-end gap-3 border-t border-[#EEF2F3] pt-5">
            <button type="button" onClick={() => navigate(-1)} className="btn-fantome">Annuler</button>
            <button type="submit" disabled={isSubmitting || succes} className="btn-primaire">
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Affecter et notifier
            </button>
          </div>
        </div>

        {/* Aperçu de l'affectation */}
        <div className="carte p-[18px_20px]">
          <div className="mb-3.5 text-xs font-semibold uppercase tracking-wide text-grisdoux">Aperçu de l'affectation</div>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-bordure bg-surface px-3 py-2.5 text-[12.5px] text-ardoise">
            <Users size={16} className="text-petrole-600" />
            {selection.length === 0
              ? "Aucun agent sélectionné."
              : `${selection.length} agent(s) — une tâche par agent sera créée.`}
          </div>
          <div className="mb-3 text-[14.5px] font-semibold leading-snug text-encre">{val.titre || "Rubrique"}</div>
          <div className="mb-3.5 flex flex-wrap gap-2">
            <CategorieTag categorie={val.categorie} />
            <PrioriteBadge priorite={val.priorite} />
            <StatutBadge statut={val.statut} />
          </div>
          <div className="flex items-center justify-between border-t border-[#EEF2F3] pt-3">
            <span className="text-[12px] text-grisdoux">
              {val.date_debut && val.date_fin
                ? `du ${val.date_debut.slice(8)}/${val.date_debut.slice(5, 7)} au ${val.date_fin.slice(8)}/${val.date_fin.slice(5, 7)}`
                : "—"}
            </span>
            <span className="font-mono text-[13px] font-semibold text-petrole-600">{formatDuree(val.duree_minutes ?? 0)}</span>
          </div>
        </div>
      </form>
    </>
  );
}

function Champ({ label, requis, erreur, children }: { label: string; requis?: boolean; erreur?: string; children: React.ReactNode }) {
  return (
    <div className="mb-[18px]">
      <label className="label">{label} {requis && <span className="text-danger">*</span>}</label>
      {children}
      {erreur && <p className="mt-1 text-[12px] text-danger">{erreur}</p>}
    </div>
  );
}

function BoutonChoix({ actif, couleur, fond, onClick, children }: { actif: boolean; couleur: string; fond: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border px-3 py-2.5 text-[12.5px] font-medium transition"
      style={actif ? { borderColor: couleur, color: couleur, background: fond, borderWidth: 1.5 } : { borderColor: "#CDD8DC", color: "#5E717B", background: "#fff" }}
    >
      {children}
    </button>
  );
}
