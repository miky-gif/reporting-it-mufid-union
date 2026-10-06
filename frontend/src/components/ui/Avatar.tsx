import { couleurAvatar } from "@/lib/constants";
import { initiales } from "@/lib/format";
import { usePhoto } from "@/lib/photos";

export function Avatar({
  nom,
  id = 0,
  couleur,
  taille = 36,
  photo,
}: {
  nom: string;
  id?: number;
  couleur?: string;
  taille?: number;
  /** URL de la photo de profil (`photo_url`). Sans elle : les initiales. */
  photo?: string | null;
}) {
  const source = usePhoto(photo);

  // Le fond coloré reste posé même avec une photo : il sert de place tenue
  // pendant le chargement, et d'arrière-plan si l'image a de la transparence.
  return (
    <span
      className="relative flex flex-none items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{
        width: taille,
        height: taille,
        background: couleur ?? couleurAvatar(id),
        fontSize: taille * 0.36,
      }}
    >
      {initiales(nom)}
      {source && (
        <img
          src={source}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      )}
    </span>
  );
}
