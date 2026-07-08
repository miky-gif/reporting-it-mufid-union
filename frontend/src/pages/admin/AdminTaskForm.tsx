import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, Loader2, Send, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { api, messageErreur } from "@/lib/api";
import { LISTE_PRIORITES, LISTE_STATUTS, PRIORITES, STATUTS } from "@/lib/constants";
import { useCategories } from "@/context/CategoriesContext";
import { isoDate } from "@/lib/format";
import type { Categorie, Priorite, Statut, UserWithStats } from "@/types";
import { Avatar } from "@/components/ui/Avatar";
import { CategorieTag, PrioriteBadge, StatutBadge } from "@/components/ui/Badges";
import { EnteteSection, Spinner } from "@/components/ui/Divers";

const schema = z.object({
  user_id: z.coerce.number().int().positive("Sélectionnez un employé."),
  categorie: z.string().min(1, "La catégorie est requise."),
  titre: z.string().min(2, "La rubrique est requise.").max(200),
  description: z.string().max(2000).optional(),
  livrable: z.string().max(1000).optional(),
  activites_a_mener: z.string().max(1000).optional(),
  priorite: z.enum(LISTE_PRIORITES as [Priorite, ...Priorite[]]),
  statut: z.enum(LISTE_STATUTS as [Statut, ...Statut[]]),
  date_activite: z.string().min(1, "La date est requise."),
  duree_heures: z.coerce.number().min(0).max(24),
});
type FormValues = z.infer<typeof schema>;

export default function AdminTaskForm() {
  const navigate = useNavigate();
  const { actives, rubriquesOf, chargement: catChargement } = useCategories();
  const [employes, setEmployes] = useState<UserWithStats[] | null>(null);
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
      user_id: 0,
      categorie: "",
      titre: "",
      description: "",
      livrable: "",
      activites_a_mener: "",
      priorite: "MOYENNE",
      statut: "A_FAIRE", // une tâche affectée démarre « À faire »
      date_activite: isoDate(new Date()),
      duree_heures: 1,
    },
  });
  const val = watch();

  useEffect(() => {
    api.get<UserWithStats[]>("/users").then((r) => {
      // On n'affecte qu'aux comptes actifs.
      setEmployes(r.data.filter((u) => u.actif));
    });
  }, []);

  // Initialise catégorie + rubrique dès que les catégories sont chargées.
  useEffect(() => {
    if (val.categorie || catChargement || actives.length === 0) return;
    setValue("categorie", actives[0].code);
    setValue("titre", actives[0].rubriques[0] ?? "");
  }, [val.categorie, catChargement, actives, setValue]);

  const rubriques = useMemo(() => rubriquesOf(val.categorie), [val.categorie, rubriquesOf]);
  const employeCible = employes?.find((e) => e.id === Number(val.user_id));

  function changerCategorie(cat: Categorie) {
    setValue("categorie", cat);
    const rubs = rubriquesOf(cat);
    if (!rubs.includes(val.titre)) setValue("titre", rubs[0] ?? "");
  }

  async function soumettre(valeurs: FormValues) {
    setErreur(null);
    try {
      await api.post("/activites", valeurs);
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
        sousTitre="Créez une tâche et attribuez-la à un employé. Il sera notifié (plateforme + e-mail)."
      />

      {succes && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#B7DEC9] bg-succes/5 px-3 py-2.5 text-[13px] text-succes">
          <Check size={17} /> Tâche affectée. L'employé a été notifié.
        </div>
      )}
      {erreur && (
        <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
          {erreur}
        </div>
      )}

      <form onSubmit={handleSubmit(soumettre)} className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="carte p-[26px_28px]">
          <Champ label="Employé" requis erreur={errors.user_id?.message}>
            <select className="champ" {...register("user_id")}>
              <option value={0}>— Sélectionnez un employé —</option>
              {employes.map((e) => (
                <option key={e.id} value={e.id}>{e.nom_complet} — {e.poste}</option>
              ))}
            </select>
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

          <Champ label="État d'exécution / consignes">
            <textarea rows={3} className="champ resize-y" placeholder="Précisez les attentes, le périmètre. Une action par ligne (repris en puces dans le rapport)…" {...register("description")} />
          </Champ>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Résultat attendu (livrable)">
              <textarea rows={2} className="champ resize-y" placeholder="Ex. Fichier des incidents, rapport produit…" {...register("livrable")} />
            </Champ>
            <Champ label="Activités à mener (semaine suivante)">
              <textarea rows={2} className="champ resize-y" placeholder="Prochaines étapes / suite à donner…" {...register("activites_a_mener")} />
            </Champ>
          </div>

          <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Durée estimée (heures)" requis erreur={errors.duree_heures?.message}>
              <input type="number" step="0.5" min="0" className="champ font-mono" {...register("duree_heures")} />
            </Champ>
            <Champ label="Échéance" requis erreur={errors.date_activite?.message}>
              <input type="date" className="champ font-mono" {...register("date_activite")} />
            </Champ>
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
              {LISTE_STATUTS.map((s) => (
                <BoutonChoix key={s} actif={val.statut === s} couleur={STATUTS[s].couleur} fond={STATUTS[s].fond} onClick={() => setValue("statut", s)}>
                  {STATUTS[s].libelle}
                </BoutonChoix>
              ))}
            </div>
          </Champ>

          <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F3] pt-5">
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
          {employeCible ? (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-bordure bg-surface px-3 py-2.5">
              <Avatar nom={employeCible.nom_complet} id={employeCible.id} taille={36} />
              <div>
                <div className="text-[13px] font-semibold text-encre">{employeCible.nom_complet}</div>
                <div className="text-[11.5px] text-grisdoux">{employeCible.poste ?? "—"}</div>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-dashed border-[#C6D2D7] px-3 py-3 text-[12.5px] text-grisdoux">
              <UserCheck size={16} /> Aucun employé sélectionné.
            </div>
          )}
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
      className="flex-1 rounded-lg border px-3 py-2.5 text-[12.5px] font-medium transition"
      style={actif ? { borderColor: couleur, color: couleur, background: fond, borderWidth: 1.5 } : { borderColor: "#CDD8DC", color: "#5E717B", background: "#fff" }}
    >
      {children}
    </button>
  );
}
