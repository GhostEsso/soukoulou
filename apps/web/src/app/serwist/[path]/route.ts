import { createSerwistRoute } from "@serwist/turbopack";

// Sert le service worker en /serwist/sw.js. Le projet n'est pas un dépôt git :
// une révision aléatoire par build suffit pour invalider la page hors ligne précachée.
const revision = crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
