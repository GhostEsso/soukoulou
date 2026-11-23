/// <reference lib="esnext" />
/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig, SerwistPlugin } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist, StaleWhileRevalidate } from "serwist";
import { purgeUserCaches } from "@/lib/user-caches";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Données du compte connecté (pages, photos, fichiers) : réseau d'abord, cache si hors ligne.
// Sécurité : sur un appareil partagé, ces caches ne doivent pas survivre au compte.
// Tout chemin de sortie (déconnexion, session expirée, proxy) finit sur /connexion :
// dès qu'une réponse /connexion passe ici, on vide ces caches (le formulaire de connexion
// le fait aussi, pour la déconnexion par action serveur qui ne repasse pas par le SW).
const DAY = 24 * 60 * 60;

const isLoginPage = (url: string) => new URL(url).pathname.startsWith("/connexion");

const purgeOnLogout: SerwistPlugin = {
  async cacheWillUpdate({ request, response }) {
    if (isLoginPage(response.url)) {
      // Seulement une vraie navigation : un simple lien vers /connexion préchargé par Next
      // (requête RSC) ne veut pas dire que la session est finie.
      if (request.mode === "navigate") await purgeUserCaches();
      return null;
    }
    // Pas de redirections ni d'erreurs : seulement les vraies pages.
    return response.status === 200 && !response.redirected ? response : null;
  },
};

const userData = (cacheName: string) =>
  new NetworkFirst({
    cacheName,
    networkTimeoutSeconds: 5,
    // ponytail: 7 jours / 50 entrées par cache, assez pour revoir les dernières pages hors ligne.
    plugins: [purgeOnLogout, new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * DAY })],
  });

const isAppPath = (pathname: string) => !pathname.startsWith("/_next/") && !pathname.startsWith("/serwist/");
const isUserFile = (pathname: string) => pathname.startsWith("/photos/") || pathname.startsWith("/fichiers/");

// Hors ligne : dernière version vue de chaque page, sinon /~offline.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url, sameOrigin }) => sameOrigin && request.mode === "navigate" && isAppPath(url.pathname),
      handler: userData("pages"),
    },
    {
      // Navigations côté client de Next (requêtes RSC).
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin && request.headers.get("RSC") === "1" && isAppPath(url.pathname),
      handler: userData("pages-rsc"),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && isUserFile(url.pathname),
      handler: userData("user-files"),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/_next/static/"),
      handler: new CacheFirst({
        cacheName: "next-static",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
    {
      // Les photos d'élèves sont gérées plus haut (user-files) : celles-ci sont les ressources publiques.
      matcher: ({ request }) => request.destination === "font" || request.destination === "image",
      handler: new StaleWhileRevalidate({
        cacheName: "assets",
        plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 })],
      }),
    },
  ],
  fallbacks: {
    entries: [{ url: "/~offline", matcher: ({ request }) => request.destination === "document" }],
  },
});

serwist.addEventListeners();
