import {
  Building2,
  Check,
  Loader2,
  Mail,
  MailCheck,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, messageErreur } from "@/lib/api";
import type { Departement } from "@/types";
import { EnteteSection, Spinner } from "@/components/ui/Divers";

export default function Departements() {
  const [deps, setDeps] = useState<Departement[] | null>(null);
  const [edition, setEdition] = useState<Departement | "nouveau" | null>(null);
  const [smtp, setSmtp] = useState<Departement | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = () =>
    api.get<Departement[]>("/departements").then((r) => setDeps(r.data));

  useEffect(() => {
    charger();
  }, []);

  async function supprimer(d: Departement) {
    if (!confirm(`Désactiver le département « ${d.nom} » ?`)) return;
    setErreur(null);
    try {
      await api.delete(`/departements/${d.id}`);
      charger();
    } catch (err) {
      setErreur(messageErreur(err, "Suppression impossible."));
    }
  }

  if (!deps) return <Spinner />;

  return (
    <>
      <EnteteSection
        titre="Départements"
        sousTitre="Organisez la direction en départements. Chacun a ses agents, ses catégories et sa boîte d'envoi."
        action={
          <button onClick={() => setEdition("nouveau")} className="btn-primaire">
            <Plus size={19} /> Nouveau département
          </button>
        }
      />

      {erreur && (
        <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
          {erreur}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {deps.map((d) => (
          <div key={d.id} className={"carte p-[20px_22px] " + (d.actif ? "" : "opacity-60")}>
            <div className="mb-3 flex items-start gap-3">
              <span
                className="mt-1 h-9 w-9 flex-none rounded-lg"
                style={{ background: d.couleur + "1F", color: d.couleur }}
              >
                <Building2 size={20} className="m-2" style={{ color: d.couleur }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-encre">{d.nom}</span>
                  {!d.actif && (
                    <span className="rounded bg-[#EDF1F2] px-1.5 py-0.5 text-[10px] font-semibold text-grisdoux">
                      désactivé
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[12.5px] text-gris">
                  {d.description || <span className="italic text-grisdoux">Aucune description</span>}
                </div>
              </div>
              <div className="flex flex-none gap-2 text-grisdoux">
                <button onClick={() => setEdition(d)} title="Modifier" className="hover:text-petrole-600">
                  <Pencil size={17} />
                </button>
                <button onClick={() => supprimer(d)} title="Désactiver" className="hover:text-danger">
                  <Trash2 size={17} />
                </button>
              </div>
            </div>

            {/* Effectifs */}
            <div className="mb-3 grid grid-cols-4 gap-2">
              <Chiffre label="Admins" valeur={d.nb_admins ?? 0} />
              <Chiffre label="Agents IT" valeur={d.nb_agents ?? 0} />
              <Chiffre label="Catégories" valeur={d.nb_categories ?? 0} />
              <Chiffre label="Activités" valeur={d.nb_activites ?? 0} />
            </div>

            {/* Boîte d'envoi */}
            <button
              onClick={() => setSmtp(d)}
              className={
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-[12.5px] transition " +
                (d.smtp_configure
                  ? "border-[#B7DEC9] bg-succes/5 text-succes hover:bg-succes/10"
                  : "border-dashed border-[#C6D2D7] text-grisdoux hover:border-petrole-600 hover:text-petrole-600")
              }
            >
              {d.smtp_configure ? <MailCheck size={16} /> : <Mail size={16} />}
              <span className="min-w-0 flex-1 truncate">
                {d.smtp_configure ? (
                  <>Boîte d'envoi : <strong>{d.smtp_user}</strong></>
                ) : (
                  "Aucune boîte d'envoi — les mails partent de la configuration globale"
                )}
              </span>
              <span className="flex-none font-medium">Configurer</span>
            </button>
          </div>
        ))}
      </div>

      {deps.length === 0 && (
        <div className="carte px-6 py-12 text-center text-[13px] text-grisdoux">
          Aucun département. Créez-en un pour commencer.
        </div>
      )}

      {edition && (
        <ModalDepartement
          dep={edition === "nouveau" ? null : edition}
          onFermer={() => setEdition(null)}
          onSucces={() => {
            setEdition(null);
            charger();
          }}
        />
      )}

      {smtp && (
        <ModalSmtp
          dep={smtp}
          onFermer={() => setSmtp(null)}
          onSucces={() => {
            setSmtp(null);
            charger();
          }}
        />
      )}
    </>
  );
}

function Chiffre({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="rounded-lg border border-[#EEF2F3] px-2 py-1.5 text-center">
      <div className="font-mono text-[15px] font-semibold text-encre">{valeur}</div>
      <div className="text-[10.5px] text-grisdoux">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Création / modification d'un département                            */
/* ------------------------------------------------------------------ */
function ModalDepartement({
  dep,
  onFermer,
  onSucces,
}: {
  dep: Departement | null;
  onFermer: () => void;
  onSucces: () => void;
}) {
  const [nom, setNom] = useState(dep?.nom ?? "");
  const [description, setDescription] = useState(dep?.description ?? "");
  const [couleur, setCouleur] = useState(dep?.couleur ?? "#0E5E7C");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre() {
    setErreur(null);
    if (nom.trim().length < 2) return setErreur("Le nom du département est requis.");
    setEnCours(true);
    try {
      const corps = { nom: nom.trim(), description: description.trim() || null, couleur };
      if (dep) await api.put(`/departements/${dep.id}`, corps);
      else await api.post("/departements", corps);
      onSucces();
    } catch (err) {
      setErreur(messageErreur(err, "Enregistrement impossible."));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Cadre titre={dep ? "Modifier le département" : "Nouveau département"} onFermer={onFermer}>
      <div className="mb-[18px]">
        <label className="label">Nom <span className="text-danger">*</span></label>
        <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. Infrastructure" />
      </div>
      <div className="mb-[18px]">
        <label className="label">Description</label>
        <textarea
          rows={2}
          className="champ resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Périmètre du département…"
        />
      </div>
      <div className="mb-[18px]">
        <label className="label">Couleur</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="h-10 w-16 cursor-pointer rounded border border-bordure"
            value={couleur}
            onChange={(e) => setCouleur(e.target.value)}
          />
          <span className="font-mono text-[13px] text-gris">{couleur}</span>
        </div>
      </div>
      {erreur && (
        <div className="mb-3 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
          {erreur}
        </div>
      )}
      <Actions onFermer={onFermer}>
        <button onClick={soumettre} disabled={enCours} className="btn-primaire">
          {enCours ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {dep ? "Enregistrer" : "Créer le département"}
        </button>
      </Actions>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* Boîte d'envoi SMTP du département                                   */
/* ------------------------------------------------------------------ */
function ModalSmtp({
  dep,
  onFermer,
  onSucces,
}: {
  dep: Departement;
  onFermer: () => void;
  onSucces: () => void;
}) {
  const [host, setHost] = useState(dep.smtp_host ?? "smtp.office365.com");
  const [port, setPort] = useState(String(dep.smtp_port ?? 587));
  const [user, setUser] = useState(dep.smtp_user ?? "");
  const [pass, setPass] = useState("");
  const [from, setFrom] = useState(dep.mail_from ?? "");
  const [tlsInsecure, setTlsInsecure] = useState(dep.smtp_tls_insecure);
  const [enCours, setEnCours] = useState(false);
  const [test, setTest] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; texte: string } | null>(null);

  async function enregistrer() {
    setMsg(null);
    setEnCours(true);
    try {
      await api.put(`/departements/${dep.id}/smtp`, {
        smtp_host: host.trim() || null,
        smtp_port: Number(port) || 587,
        smtp_user: user.trim() || null,
        smtp_pass: pass || undefined, // vide = on garde l'existant
        mail_from: from.trim() || null,
        smtp_tls_insecure: tlsInsecure,
      });
      setMsg({ type: "ok", texte: "Configuration enregistrée." });
      setPass("");
    } catch (err) {
      setMsg({ type: "err", texte: messageErreur(err, "Enregistrement impossible.") });
    } finally {
      setEnCours(false);
    }
  }

  async function tester() {
    setMsg(null);
    setTest(true);
    try {
      const r = await api.post(`/departements/${dep.id}/smtp/test`);
      setMsg({ type: "ok", texte: r.data.detail });
    } catch (err) {
      setMsg({ type: "err", texte: messageErreur(err, "Test impossible.") });
    } finally {
      setTest(false);
    }
  }

  return (
    <Cadre titre={`Boîte d'envoi — ${dep.nom}`} onFermer={onFermer} large>
      <p className="mb-4 text-[12.5px] leading-snug text-gris">
        Les notifications destinées aux agents de ce département partiront de cette boîte.
        Si elle n'est pas configurée, la configuration globale du serveur est utilisée.
      </p>

      <div className="mb-[18px] grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label className="label">Serveur SMTP</label>
          <input className="champ font-mono" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.office365.com" />
        </div>
        <div>
          <label className="label">Port</label>
          <input className="champ font-mono" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
        </div>
      </div>

      <div className="mb-[18px]">
        <label className="label">Identifiant (adresse de la boîte)</label>
        <input className="champ" value={user} onChange={(e) => setUser(e.target.value)} placeholder="infrastructure@mufidunion.cm" />
      </div>

      <div className="mb-[18px]">
        <label className="label">Mot de passe</label>
        <input
          type="password"
          className="champ"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder={dep.smtp_configure ? "•••••••• (laisser vide pour conserver)" : "Mot de passe de la boîte"}
        />
      </div>

      <div className="mb-[18px]">
        <label className="label">Expéditeur affiché</label>
        <input
          className="champ"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder={`MUFID UNION — ${dep.nom} <${user || "adresse@mufidunion.cm"}>`}
        />
        <p className="mt-1 text-[11.5px] text-grisdoux">
          Doit correspondre à l'identifiant ci-dessus (les serveurs refusent l'usurpation d'expéditeur).
        </p>
      </div>

      <label className="mb-3 flex cursor-pointer items-start gap-2.5 text-[12.5px] text-ardoise">
        <input type="checkbox" className="mt-0.5" checked={tlsInsecure} onChange={(e) => setTlsInsecure(e.target.checked)} />
        Accepter un certificat auto-signé (serveur de messagerie interne)
      </label>

      {msg && (
        <div
          className={
            "mb-3 rounded-lg border px-3 py-2 text-[12.5px] " +
            (msg.type === "ok"
              ? "border-[#B7DEC9] bg-succes/5 text-succes"
              : "border-[#EBC7C1] bg-danger/5 text-danger")
          }
        >
          {msg.texte}
        </div>
      )}

      <Actions onFermer={onFermer}>
        <button onClick={tester} disabled={test || enCours} className="btn-fantome">
          {test ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Tester la connexion
        </button>
        <button onClick={enregistrer} disabled={enCours || test} className="btn-primaire">
          {enCours ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Enregistrer
        </button>
      </Actions>
      <div className="mt-3 text-right">
        <button onClick={onSucces} className="text-[12.5px] font-medium text-petrole-600">
          Terminé
        </button>
      </div>
    </Cadre>
  );
}

/* ------------------------------------------------------------------ */
/* Cadre de fenêtre modale (réutilisé)                                 */
/* ------------------------------------------------------------------ */
function Cadre({
  titre,
  onFermer,
  children,
  large,
}: {
  titre: string;
  onFermer: () => void;
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-encre/40" onClick={onFermer} />
      <div
        className={
          "fixed left-1/2 top-1/2 z-50 max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl2 border border-bordure bg-white shadow-popover " +
          (large ? "w-[min(600px,calc(100vw-32px))]" : "w-[min(500px,calc(100vw-32px))]")
        }
      >
        <div className="flex items-center justify-between border-b border-[#EEF2F3] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Users size={19} className="text-petrole-600" />
            <span className="text-[15px] font-semibold text-encre">{titre}</span>
          </div>
          <button onClick={onFermer} className="text-grisdoux hover:text-encre">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </>
  );
}

function Actions({ onFermer, children }: { onFermer: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-[#EEF2F3] pt-4">
      <button onClick={onFermer} className="btn-fantome">Fermer</button>
      {children}
    </div>
  );
}
