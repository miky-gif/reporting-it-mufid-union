import { GripVertical, Loader2, Plus, X } from "lucide-react";
import { useState } from "react";
import { api, messageErreur } from "@/lib/api";
import type { CategorieDef } from "@/types";

const COULEURS_SUGGEREES = [
  "#0E5E7C", "#2F6FE0", "#7E57C2", "#1F9D74", "#D08A21", "#C0392B", "#14708F", "#64757D",
];

export function CategorieModal({
  categorie,
  onClose,
  onSaved,
}: {
  categorie?: CategorieDef;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edition = !!categorie;
  const [nom, setNom] = useState(categorie?.nom ?? "");
  const [couleur, setCouleur] = useState(categorie?.couleur ?? "#0E5E7C");
  const [rubriques, setRubriques] = useState<string[]>(categorie?.rubriques ?? []);
  const [nouvelle, setNouvelle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  function ajouterRubrique() {
    const r = nouvelle.trim();
    if (!r) return;
    if (rubriques.some((x) => x.toLowerCase() === r.toLowerCase())) {
      setNouvelle("");
      return;
    }
    setRubriques((prev) => [...prev, r]);
    setNouvelle("");
  }

  function modifierRubrique(i: number, valeur: string) {
    setRubriques((prev) => prev.map((r, idx) => (idx === i ? valeur : r)));
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    const rubNettoyees = rubriques.map((r) => r.trim()).filter(Boolean);
    setEnCours(true);
    try {
      const corps = { nom, couleur, rubriques: rubNettoyees };
      if (edition) await api.put(`/categories/${categorie!.id}`, corps);
      else await api.post("/categories", corps);
      onSaved();
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-encre/40 p-4" onClick={onClose}>
      <form
        onSubmit={soumettre}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-panneau"
      >
        <div className="flex items-center justify-between border-b border-[#EEF2F3] px-6 py-4">
          <h3 className="text-lg font-semibold text-encre">
            {edition ? "Modifier la catégorie" : "Nouvelle catégorie"}
          </h3>
          <button type="button" onClick={onClose} className="text-grisdoux hover:text-ardoise">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {erreur && (
            <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
              {erreur}
            </div>
          )}

          <div className="mb-4">
            <label className="label">Nom de la catégorie <span className="text-danger">*</span></label>
            <input className="champ" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Base de données" />
          </div>

          <div className="mb-5">
            <label className="label">Couleur</label>
            <div className="flex items-center gap-3">
              <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-bordure" />
              <span className="font-mono text-[13px] text-gris">{couleur.toUpperCase()}</span>
              <div className="flex flex-wrap gap-1.5">
                {COULEURS_SUGGEREES.map((c) => (
                  <button key={c} type="button" onClick={() => setCouleur(c)} className="h-6 w-6 rounded-md border border-black/5" style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Rubriques ({rubriques.length})</label>
            <div className="flex flex-col gap-2">
              {rubriques.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <GripVertical size={16} className="flex-none text-[#C6D2D7]" />
                  <input className="champ flex-1 py-2" value={r} onChange={(e) => modifierRubrique(i, e.target.value)} />
                  <button type="button" onClick={() => setRubriques((prev) => prev.filter((_, idx) => idx !== i))} className="flex-none text-grisdoux hover:text-danger" title="Retirer">
                    <X size={18} />
                  </button>
                </div>
              ))}
              {rubriques.length === 0 && (
                <p className="text-[12.5px] text-grisdoux">Aucune rubrique. Ajoutez-en au moins une pour cette catégorie.</p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                className="champ flex-1 py-2"
                value={nouvelle}
                onChange={(e) => setNouvelle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    ajouterRubrique();
                  }
                }}
                placeholder="Nouvelle rubrique…"
              />
              <button type="button" onClick={ajouterRubrique} className="btn-secondaire flex-none px-3 py-2">
                <Plus size={17} /> Ajouter
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-[#EEF2F3] px-6 py-4">
          <button type="button" onClick={onClose} className="btn-fantome">Annuler</button>
          <button type="submit" disabled={enCours} className="btn-primaire">
            {enCours && <Loader2 size={18} className="animate-spin" />}
            {edition ? "Enregistrer" : "Créer la catégorie"}
          </button>
        </div>
      </form>
    </div>
  );
}
