import { Download, FileUp, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { telechargerFichier } from "@/lib/download";
import type { PieceJointe } from "@/types";

const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo

function tailleLisible(o: number): string {
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Gestion des pièces jointes d'une activité.
 * - activiteId défini (édition) : téléverse/supprime immédiatement côté serveur.
 * - activiteId null (création) : conserve les fichiers en attente (uploadés
 *   après la création par le formulaire parent, via `pending`/`onPendingChange`).
 */
export function PiecesJointes({
  activiteId,
  pending,
  onPendingChange,
}: {
  activiteId: number | null;
  pending: File[];
  onPendingChange: (files: File[]) => void;
}) {
  const [pieces, setPieces] = useState<PieceJointe[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activiteId) return;
    api
      .get(`/activites/${activiteId}`)
      .then((r) => setPieces(r.data.pieces ?? []))
      .catch(() => {});
  }, [activiteId]);

  async function ajouter(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErreur(null);
    const liste = Array.from(files);
    for (const f of liste) {
      if (f.size > TAILLE_MAX) {
        setErreur(`« ${f.name} » dépasse 10 Mo.`);
        continue;
      }
      if (activiteId) {
        setChargement(true);
        try {
          const fd = new FormData();
          fd.append("fichier", f);
          const r = await api.post(`/activites/${activiteId}/pieces`, fd);
          setPieces((p) => [...p, r.data]);
        } catch (err) {
          setErreur(messageErreur(err, "Téléversement impossible."));
        } finally {
          setChargement(false);
        }
      } else {
        onPendingChange([...pending, f]);
      }
    }
    if (input.current) input.current.value = "";
  }

  async function supprimer(id: number) {
    if (!activiteId) return;
    await api.delete(`/activites/${activiteId}/pieces/${id}`).catch(() => {});
    setPieces((p) => p.filter((x) => x.id !== id));
  }

  async function telecharger(p: PieceJointe) {
    await telechargerFichier(`/activites/${activiteId}/pieces/${p.id}`, {}).catch(() => {});
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-ardoise">
        <Paperclip size={15} /> Pièces jointes
      </div>

      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => ajouter(e.target.files)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#C6D2D7] bg-surface px-3 py-3 text-[12.5px] font-medium text-gris hover:border-petrole-600 hover:text-petrole-600"
      >
        {chargement ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
        Ajouter un fichier (PDF, Word, Excel, image — 10 Mo max)
      </button>

      {erreur && <p className="mt-1.5 text-[12px] text-danger">{erreur}</p>}

      {/* Fichiers déjà enregistrés (édition) */}
      {pieces.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {pieces.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-bordure bg-white px-3 py-2 text-[12.5px]">
              <Paperclip size={14} className="flex-none text-grisdoux" />
              <span className="min-w-0 flex-1 truncate text-ardoise">{p.nom_fichier}</span>
              <span className="flex-none font-mono text-[11px] text-grisdoux">{tailleLisible(p.taille)}</span>
              <button type="button" onClick={() => telecharger(p)} title="Télécharger" className="flex-none text-petrole-600 hover:text-petrole-800">
                <Download size={15} />
              </button>
              <button type="button" onClick={() => supprimer(p.id)} title="Supprimer" className="flex-none text-danger hover:opacity-70">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Fichiers en attente (création) */}
      {!activiteId && pending.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {pending.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-dashed border-bordure bg-surface px-3 py-2 text-[12.5px]">
              <Paperclip size={14} className="flex-none text-grisdoux" />
              <span className="min-w-0 flex-1 truncate text-ardoise">{f.name}</span>
              <span className="flex-none font-mono text-[11px] text-grisdoux">{tailleLisible(f.size)}</span>
              <span className="flex-none text-[11px] italic text-grisdoux">à téléverser</span>
              <button type="button" onClick={() => onPendingChange(pending.filter((_, j) => j !== i))} className="flex-none text-danger hover:opacity-70">
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Téléverse les fichiers en attente après création d'une activité.
export async function televerserEnAttente(activiteId: number, files: File[]) {
  for (const f of files) {
    const fd = new FormData();
    fd.append("fichier", f);
    await api.post(`/activites/${activiteId}/pieces`, fd).catch(() => {});
  }
}
