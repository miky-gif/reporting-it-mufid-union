import { Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GROUPES_PERMISSIONS, PERMISSIONS, PERMISSIONS_DEFAUT } from "@/lib/constants";
import type { Departement, Permission, Role, UserWithStats } from "@/types";

export function UserModal({
  user,
  onClose,
  onSaved,
}: {
  user?: UserWithStats;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { estSuperAdmin, user: moi } = useAuth();
  const edition = !!user;
  // Édition de SON PROPRE compte : le rôle et le département sont verrouillés,
  // sinon un super admin pourrait se rétrograder et bloquer la plateforme.
  const monCompte = edition && user!.id === moi?.id;

  const [nom, setNom] = useState(user?.nom_complet ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [poste, setPoste] = useState(user?.poste ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "EMPLOYE");
  const [actif, setActif] = useState(user?.actif ?? true);
  const [motDePasse, setMotDePasse] = useState("");
  const [departementId, setDepartementId] = useState<number | "">(
    user?.departement_id ?? (estSuperAdmin ? "" : moi?.departement_id ?? ""),
  );
  const [droits, setDroits] = useState<Permission[]>(
    user?.permissions?.length ? user.permissions : PERMISSIONS_DEFAUT,
  );
  const [deps, setDeps] = useState<Departement[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Le super admin choisit le département ; un admin crée dans le sien.
  useEffect(() => {
    if (!estSuperAdmin) return;
    api.get<Departement[]>("/departements").then((r) => setDeps(r.data.filter((d) => d.actif)));
  }, [estSuperAdmin]);

  const estAdminCible = role === "ADMIN";

  function basculer(d: Permission) {
    setDroits((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!monCompte && estSuperAdmin && role !== "SUPER_ADMIN" && !departementId) {
      return setErreur("Sélectionnez le département de rattachement.");
    }
    setEnCours(true);
    try {
      const corps: Record<string, unknown> = { nom_complet: nom, email, poste, actif };
      // Sur son propre compte, on n'envoie ni rôle ni département (verrouillés).
      if (!monCompte) {
        corps.role = role;
        if (estSuperAdmin) {
          corps.departement_id = role === "SUPER_ADMIN" ? null : departementId || null;
          if (estAdminCible) corps.permissions = droits;
        }
      }
      if (motDePasse) corps.mot_de_passe = motDePasse;

      if (edition) await api.put(`/users/${user!.id}`, corps);
      else await api.post("/users", { ...corps, mot_de_passe: motDePasse });
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
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-panneau"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-encre">
            {edition ? "Modifier l'utilisateur" : "Créer un utilisateur"}
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
            <input className="champ" value={poste} onChange={(e) => setPoste(e.target.value)} placeholder="Ex. Ingénieur réseau" />
          </div>

          {/* Rôle : verrouillé sur son propre compte (anti-rétrogradation) */}
          <div>
            <label className="label">Rôle</label>
            <select
              className="champ"
              value={role}
              disabled={!estSuperAdmin || monCompte}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="EMPLOYE">IT</option>
              {estSuperAdmin && <option value="ADMIN">Administrateur de département</option>}
              {/* Affiché pour que le rôle réel soit visible (jamais sélectionnable soi-même) */}
              {role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super administrateur</option>}
            </select>
            {!estSuperAdmin && (
              <p className="mt-1 text-[11.5px] text-grisdoux">
                Seul le super administrateur peut créer un administrateur.
              </p>
            )}
          </div>

          {/* Verrou explicite quand on modifie son propre compte */}
          {monCompte && (
            <div className="flex items-start gap-2 rounded-lg border border-[#F0D8A8] bg-attention/10 px-3 py-2.5 text-[12px] leading-snug text-ardoise sm:col-span-2">
              <Lock size={15} className="mt-0.5 flex-none text-attention" />
              <span>
                Vous modifiez <strong>votre propre compte</strong> : le rôle et le département sont
                verrouillés. Vous pouvez librement changer vos <strong>nom, e-mail, poste et mot de passe</strong>.
              </span>
            </div>
          )}

          {/* Département : sans objet pour un super admin (il les voit tous) */}
          {role === "SUPER_ADMIN" ? (
            <div className="sm:col-span-2 rounded-lg border border-bordure bg-surface px-3 py-2.5 text-[12.5px] text-gris">
              Un super administrateur n'est rattaché à <strong>aucun département</strong> : il les supervise tous.
            </div>
          ) : estSuperAdmin && !monCompte ? (
            <div className="sm:col-span-2">
              <label className="label">Département <span className="text-danger">*</span></label>
              <select
                className="champ"
                value={departementId}
                onChange={(e) => setDepartementId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">— Sélectionnez un département —</option>
                {deps.map((d) => (
                  <option key={d.id} value={d.id}>{d.nom}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="sm:col-span-2 rounded-lg border border-[#DCE9ED] bg-petrole-50 px-3 py-2.5 text-[12.5px] text-ardoise">
              Rattaché à votre département : <strong>{moi?.departement?.nom ?? "—"}</strong>
            </div>
          )}

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

        {/* Droits accordés à l'administrateur (super admin uniquement) */}
        {estSuperAdmin && estAdminCible && (
          <div className="mt-5 rounded-xl2 border border-[#DCE9ED] bg-petrole-50/60 p-4">
            <div className="mb-1 flex items-center gap-2 text-[13.5px] font-semibold text-petrole-700">
              <ShieldCheck size={17} /> Droits de cet administrateur
            </div>
            <p className="mb-3 text-[12px] text-gris">
              Il n'agira que dans son département, et uniquement sur ce que vous cochez ici.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {GROUPES_PERMISSIONS.map((g) => (
                <div key={g.titre} className="rounded-lg border border-bordure bg-white p-3">
                  <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-grisdoux">
                    {g.titre}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {g.droits.map((d) => (
                      <label key={d} className="flex cursor-pointer items-start gap-2 text-[12.5px] text-ardoise">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-petrole-600"
                          checked={droits.includes(d)}
                          onChange={() => basculer(d)}
                        />
                        {PERMISSIONS[d]}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-3 text-[12px] font-medium">
              <button type="button" onClick={() => setDroits(Object.keys(PERMISSIONS) as Permission[])} className="text-petrole-600">
                Tout cocher
              </button>
              <button type="button" onClick={() => setDroits([])} className="text-grisdoux">
                Tout décocher
              </button>
              <span className="ml-auto text-grisdoux">{droits.length} droit(s)</span>
            </div>
          </div>
        )}

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
