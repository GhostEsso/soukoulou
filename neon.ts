import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  auth: false,
  // Photos et pièces justificatives : privé, l'API vérifie les droits et relaie chaque fichier.
  buckets: {
    soukoulou: { access: "private" },
  },
  // Pour le futur chat (pas encore branché dans le code).
  preview: { realtime: true },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (!branch.exists) {
      // New non-default branches: auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
