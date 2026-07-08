import { Eye, EyeOff, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { useCategories } from "@/context/CategoriesContext";
import type { CategorieDef } from "@/types";
import { EnteteSection, Spinner } from "@/components/ui/Divers";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CategorieModal } from "./CategorieModal";

export default function CategoriesManagement() {
  const { categories, chargement, recharger } = useCategories();
  const [modal, setModal] = useState<{ ouvert: boolean; cat?: CategorieDef }>({ ouvert: false });
  const [aSupprimer, setASupprimer] = useState<CategorieDef | null>(null);

  async function basculerActif(cat: CategorieDef) {
    await api.put(`/categories/${cat.id}`, { actif: !cat.actif }).catch((e) => alert(messageErreur(e)));
    await recharger();
  }

  async function supprimer() {
    if (!aSupprimer) return;
    try {
      const { data } = await api.delete(`/categories/${aSupprimer.id}`);
      setASupprimer(null);
      await recharger();
      if (data?.desactivee) {
        alert(`La catégorie est utilisée par ${data.utilisations} activité(s) : elle a été désactivée (et non supprimée) pour préserver l'historique.`);
      }
    } catch (err) {
      alert(messageErreur(err));
    }
  }

  return (
    <>
      <EnteteSection
        titre="Catégories & rubriques"
        sousTitre="Gérez les catégories d'activités et leurs rubriques. Elles alimentent les formulaires de saisie."
        action={
          <button className="btn-primaire" onClick={() => setModal({ ouvert: true })}>
            <Plus size={18} /> Nouvelle catégorie
          </button>
        }
      />

      {chargement ? (
        <Spinner />
      ) : categories.length === 0 ? (
        <div className="carte flex flex-col items-center px-10 py-14 text-center">
          <Tags size={34} className="mb-4 text-petrole-600" />
          <div className="text-lg font-semibold text-encre">Aucune catégorie</div>
          <button className="btn-primaire mt-5" onClick={() => setModal({ ouvert: true })}>
            <Plus size={18} /> Créer la première catégorie
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.id} className={"carte p-5 " + (cat.actif ? "" : "opacity-60")}>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="h-4 w-4 rounded" style={{ background: cat.couleur }} />
                  <div>
                    <div className="text-[15px] font-semibold text-encre">{cat.nom}</div>
                    <div className="font-mono text-[11px] text-grisdoux">{cat.code}</div>
                  </div>
                </div>
                {!cat.actif && (
                  <span className="rounded-md bg-[#FBF0DC] px-2 py-0.5 text-[10.5px] font-semibold text-[#B4750E]">Inactive</span>
                )}
              </div>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {cat.rubriques.length === 0 ? (
                  <span className="text-[12px] text-grisdoux">Aucune rubrique</span>
                ) : (
                  cat.rubriques.map((r) => (
                    <span key={r} className="rounded-md border border-[#E8EDEE] bg-surface px-2 py-0.5 text-[11.5px] text-ardoise">
                      {r}
                    </span>
                  ))
                )}
              </div>

              <div className="flex items-center gap-1 border-t border-[#EEF2F3] pt-3">
                <button onClick={() => setModal({ ouvert: true, cat })} className="btn-fantome px-2 py-1.5 text-[12.5px]">
                  <Pencil size={15} /> Modifier
                </button>
                <button onClick={() => basculerActif(cat)} className="btn-fantome px-2 py-1.5 text-[12.5px]">
                  {cat.actif ? <EyeOff size={15} /> : <Eye size={15} />}
                  {cat.actif ? "Désactiver" : "Activer"}
                </button>
                <div className="flex-1" />
                <button onClick={() => setASupprimer(cat)} className="text-grisdoux hover:text-danger" title="Supprimer">
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.ouvert && (
        <CategorieModal
          categorie={modal.cat}
          onClose={() => setModal({ ouvert: false })}
          onSaved={async () => {
            setModal({ ouvert: false });
            await recharger();
          }}
        />
      )}

      <ConfirmDialog
        ouvert={!!aSupprimer}
        titre="Supprimer la catégorie"
        message={`« ${aSupprimer?.nom ?? ""} » sera supprimée. Si des activités l'utilisent, elle sera seulement désactivée pour préserver l'historique.`}
        libelleConfirmer="Supprimer"
        onConfirmer={supprimer}
        onAnnuler={() => setASupprimer(null)}
      />
    </>
  );
}
