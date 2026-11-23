import type { NextConfig } from "next";

// ponytail: Cache Components désactivé — tout le tableau de bord est personnel et dynamique.
// À activer le jour où on aura des pages publiques à mettre en cache.
const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dev seulement : autorise les tunnels cloudflared (test sur mobile).
  allowedDevOrigins: ["*.trycloudflare.com"],
  // Photos de profil envoyées par action serveur (2 Mo max côté API, marge pour l'enveloppe).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
