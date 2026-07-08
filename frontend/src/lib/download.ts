// Téléchargement d'un fichier binaire (PDF / Excel) depuis l'API.
import { api } from "./api";

export async function telechargerFichier(url: string, params: Record<string, unknown>) {
  const reponse = await api.get(url, { params, responseType: "blob" });

  // Récupère le nom de fichier depuis l'en-tête Content-Disposition.
  const dispo = reponse.headers["content-disposition"] as string | undefined;
  let nom = "rapport";
  const m = dispo?.match(/filename="?([^"]+)"?/);
  if (m) nom = decodeURIComponent(m[1]);

  const blob = new Blob([reponse.data]);
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(blob);
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  URL.revokeObjectURL(lien.href);
}
