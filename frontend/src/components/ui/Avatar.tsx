import { couleurAvatar } from "@/lib/constants";
import { initiales } from "@/lib/format";

export function Avatar({
  nom,
  id = 0,
  couleur,
  taille = 36,
}: {
  nom: string;
  id?: number;
  couleur?: string;
  taille?: number;
}) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: taille,
        height: taille,
        background: couleur ?? couleurAvatar(id),
        fontSize: taille * 0.36,
      }}
    >
      {initiales(nom)}
    </span>
  );
}
