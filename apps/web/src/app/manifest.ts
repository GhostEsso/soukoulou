import type { MetadataRoute } from "next";

// ponytail: pas de service worker — l'app est installable sans, mais ne marche pas hors ligne.
// À ajouter (Serwist) si on veut un mode hors ligne.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Soukoulou",
    short_name: "Soukoulou",
    description: "La gestion scolaire simple, pour chaque école.",
    start_url: "/espace",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2346c8",
    lang: "fr",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
