import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { api, messageErreur } from "@/lib/api";
import type { Role, UserWithStats } from "@/types";

export function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user?: UserWithStats;
  onClose: () => void;
  onSaved: () => void;
}) {
  const edition = !!user;
  const [nom, setNom] = useState(user?.nom_complet ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [poste, setPoste] = useState(user?.poste ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYE");
  const [actif, setActif] = useState(user?.actif ?? true);
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      if (edition) {
        const corps: Record<string, unknown> = { nom_complet: nom, email, poste, role, actif };
        if (motDePasse) corps.mot_de_passe = motDePasse;
        await api.put(`/users/${user!.id}`, corps);
      } else {
        await api.post("/users", { nom_complet: nom, email, poste, role, actif, mot_de_passe: motDePasse });
      }
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
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-panneau"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-encre">
            {edition ? "Modifier l'utilisateur" : "Inviter un utilisateur"}
          </h3>
          <button type="button" onClick={onClose} className="text-grisdoux hover:text-ardoise">
            <X size={20} />
          </button>
        </div>

        {erreur && (
          <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
            {erreur}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nom complet <span className="text-danger">*</span></label>
            <input className="champ" required value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">E-mail <span className="text-danger">*</span></label>
            <input type="email" className="champ" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Poste</label>
            <input className="champ" value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="Ex. Développeur" />
          </div>
          <div>
            <label className="label">Rôle</label>
            <select className="champ" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="EMPLOYE">Employé</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">
              Mot de passe {edition ? "(laisser vide pour ne pas changer)" : <span className="text-danger">*</span>}
            </label>
            <input
              type="password"
              className="champ"
              required={!edition}
              minLength={6}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              placeholder="6 caractères minimum"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ardoise sm:col-span-2">
            <input type="checkbox" className="accent-petrole-600" checked={actif} onChange={(e) => setActif(e.target.checked)} />
            Compte actif
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-[#EEF2F3] pt-4">
          <button type="button" onClick={onClose} className="btn-fantome">Annuler</button>
          <button type="submit" disabled={enCours} className="btn-primaire">
            {enCours && <Loader2 size={18} className="animate-spin" />}
            {edition ? "Enregistrer" : "Créer l'utilisateur"}
          </button>
        </div>
      </form>
    </div>
  );
}
