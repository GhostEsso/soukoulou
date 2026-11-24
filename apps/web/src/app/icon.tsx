import { ImageResponse } from "next/og";
import { BRAND_BLUE, LogoMark } from "@/components/logo-mark";

// Icônes de l'app (marque du composant Logo) : /icon/32 pour l'onglet, /icon/192 et /icon/512 pour le manifeste.
const SIZES = [32, 192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id);
  // Onglet : carré arrondi entier. Manifeste : fond plein bord à bord (maskable), glyphe dans la zone sûre.
  if (size <= 32) return new ImageResponse(<LogoMark size={size} radius={14} />, { width: size, height: size });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_BLUE,
        }}
      >
        <LogoMark size={size * 0.72} background="none" />
      </div>
    ),
    { width: size, height: size },
  );
}
