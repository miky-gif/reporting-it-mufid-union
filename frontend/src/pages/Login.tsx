import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { messageErreur } from "@/lib/api";

export default function Login() {
  const { connexion, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("n.fotso@mufidunion.cm");
  const [motDePasse, setMotDePasse] = useState("Mufid2026!");
  const [voirMdp, setVoirMdp] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  if (user) navigate(user.role === "ADMIN" ? "/admin" : "/", { replace: true });

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setChargement(true);
    try {
      await connexion(email, motDePasse);
      navigate("/", { replace: true });
    } catch (err) {
      setErreur(messageErreur(err, "Connexion impossible."));
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-white">
      {/* Panneau marque — plein écran (moitié gauche) */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-gradient-to-br from-petrole-700 to-petrole-900 p-14 xl:p-16 lg:flex">
          <img
            src="/logo-mufid.webp"
            className="pointer-events-none absolute -bottom-10 -right-24 w-[460px] -rotate-6 opacity-[0.05] brightness-0 invert"
          />
          <div className="inline-flex self-start rounded-xl2 bg-white px-4 py-3.5">
            <img src="/logo-mufid.webp" className="h-10" />
          </div>
          <div className="relative">
            <h1 className="text-[34px] font-bold leading-tight tracking-tight text-white">
              Plateforme de reporting
              <br />
              d'activités IT
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[#A9C4CE]">
              Saisissez vos tâches, suivez leur avancement et générez des rapports individuels ou
              consolidés pour le service informatique.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Saisie et suivi des activités au quotidien",
                "Tableaux de bord par employé et consolidés",
                "Export des rapports en PDF et Excel",
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm font-medium text-[#DCE9ED]">
                  <CheckCircle2 size={20} className="text-[#5FBB84]" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative font-mono text-[11px] tracking-wide text-[#6C97A6]">
            RÉSEAU DE MICROFINANCE · ZONE CEMAC · RÉGULÉ COBAC
          </div>
        </div>

        {/* Panneau formulaire */}
        <div className="relative flex flex-1 flex-col justify-center px-8 py-14 sm:px-16">
          <div className="mx-auto w-full max-w-[380px]">
            <div className="mb-2 flex justify-center lg:hidden">
              <img src="/logo-mufid.webp" className="h-9" />
            </div>
            <h2 className="text-[26px] font-semibold tracking-tight text-encre">Connexion</h2>
            <p className="mb-8 mt-2 text-sm text-gris">Accédez à votre espace de reporting.</p>

            {erreur && (
              <div className="mb-4 rounded-lg border border-[#EBC7C1] bg-danger/5 px-3 py-2.5 text-[13px] text-danger">
                {erreur}
              </div>
            )}

            <form onSubmit={soumettre}>
              <label className="label">Adresse e-mail professionnelle</label>
              <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-[#CDD8DC] bg-white px-3.5 py-3 focus-within:border-petrole-600 focus-within:ring-[3px] focus-within:ring-petrole-600/15">
                <Mail size={19} className="text-grisdoux" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent text-sm text-encre outline-none"
                  placeholder="prenom.nom@mufidunion.cm"
                />
              </div>

              <label className="label">Mot de passe</label>
              <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-[#CDD8DC] bg-white px-3.5 py-3 focus-within:border-petrole-600 focus-within:ring-[3px] focus-within:ring-petrole-600/15">
                <Lock size={19} className="text-petrole-600" />
                <input
                  type={voirMdp ? "text" : "password"}
                  required
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  className="w-full bg-transparent text-sm text-encre outline-none"
                  placeholder="••••••••••"
                />
                <button type="button" onClick={() => setVoirMdp((v) => !v)}>
                  {voirMdp ? (
                    <EyeOff size={19} className="text-grisdoux" />
                  ) : (
                    <Eye size={19} className="text-grisdoux" />
                  )}
                </button>
              </div>

              <div className="mb-6 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[13px] text-ardoise">
                  <input type="checkbox" defaultChecked className="accent-petrole-600" />
                  Se souvenir de moi
                </label>
                <a href="#" className="text-[13px] font-medium text-petrole-600">
                  Mot de passe oublié ?
                </a>
              </div>

              <button type="submit" disabled={chargement} className="btn-primaire w-full py-3.5 text-sm">
                {chargement ? (
                  <>
                    <Loader2 size={19} className="animate-spin" /> Connexion…
                  </>
                ) : (
                  <>
                    Se connecter <ArrowRight size={19} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-2.5 text-xs text-[#A9AFB3]">
              <span className="h-px flex-1 bg-[#EEF2F3]" /> Accès réservé au personnel
              <span className="h-px flex-1 bg-[#EEF2F3]" />
            </div>
            <p className="mt-4 text-center text-xs leading-relaxed text-grisdoux">
              Pour toute difficulté de connexion, contactez l'administrateur système :{" "}
              <span className="text-petrole-600">support@mufidunion.cm</span>
            </p>
          </div>
          <div className="absolute bottom-5 left-0 right-0 text-center text-[11px] text-[#B4BBBF]">
            © 2026 MUFID UNION — Tous droits réservés · v1.0
          </div>
        </div>
    </div>
  );
}
