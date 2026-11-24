/**
 * Marque Soukoulou (« école ») : un livre ouvert sous un soleil levant.
 * Sans dépendance React côté client : sert aussi aux icônes générées (icon.tsx, apple-icon.tsx).
 */
export const BRAND_BLUE = "#2346c8";
export const BRAND_SUN = "#ffc62e";

export function LogoMark({
  size = 28,
  background = BRAND_BLUE,
  page = "#ffffff",
  sun = BRAND_SUN,
  radius = 14,
}: {
  size?: number | string;
  /** "none" : glyphe seul, sans carré de fond. */
  background?: string;
  page?: string;
  sun?: string;
  /** Arrondi du carré, sur une grille de 64. */
  radius?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      {background !== "none" && <rect width="64" height="64" rx={radius} fill={background} />}
      <circle cx="32" cy="17" r="6.5" fill={sun} />
      <path d="M9 27C17 23.5 25.5 24 31 28.5V51C25.5 46.5 17 45.8 9 49Z" fill={page} />
      <path d="M55 27C47 23.5 38.5 24 33 28.5V51C38.5 46.5 47 45.8 55 49Z" fill={page} />
    </svg>
  );
}
