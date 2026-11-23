// Caches du service worker qui contiennent des données du compte connecté.
// Vidés à chaque arrivée sur /connexion (voir src/app/sw.ts et le formulaire de connexion).
export const USER_CACHES = ["pages", "pages-rsc", "user-files"];

export function purgeUserCaches() {
  return Promise.all(USER_CACHES.map((name) => caches.delete(name)));
}
