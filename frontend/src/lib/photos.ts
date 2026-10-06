import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Chargement des photos de profil.
 *
 * L'image est servie par une route protégée : une balise `<img src=…>` n'y
 * arriverait pas, car elle n'envoie pas le jeton. On la récupère donc par
 * l'API, comme le reste, et on la transforme en URL locale.
 *
 * Le résultat est mis en cache PAR URL, et l'URL porte une empreinte du
 * fichier. Conséquences : un même agent présent trente fois dans un tableau
 * ne déclenche qu'une seule requête, et un changement de photo produit une
 * nouvelle URL, donc un nouveau chargement.
 */
const cache = new Map<string, Promise<string | null>>();

export function chargerPhoto(url: string): Promise<string | null> {
  const dejaDemandee = cache.get(url);
  if (dejaDemandee) return dejaDemandee;

  const promesse = api
    // baseURL vaut déjà « /api » : on retire le préfixe fourni par le serveur.
    .get(url.replace(/^\/api/, ""), { responseType: "blob" })
    .then((r) => URL.createObjectURL(r.data as Blob))
    // Un échec est retenu lui aussi : inutile de rejouer une requête vouée à
    // échouer à chaque affichage. Une nouvelle photo aura une autre URL.
    .catch(() => null);

  cache.set(url, promesse);
  return promesse;
}

/** Oublie une photo : le prochain affichage la redemandera. */
export function oublierPhoto(url: string | null | undefined) {
  if (!url) return;
  const ancienne = cache.get(url);
  cache.delete(url);
  ancienne?.then((objet) => {
    if (objet) URL.revokeObjectURL(objet);
  });
}

/** Source affichable d'une photo, ou null tant qu'elle n'est pas disponible. */
export function usePhoto(url: string | null | undefined): string | null {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSource(null);
      return;
    }
    let vivant = true;
    chargerPhoto(url).then((objet) => {
      if (vivant) setSource(objet);
    });
    return () => {
      vivant = false;
    };
  }, [url]);

  return source;
}
