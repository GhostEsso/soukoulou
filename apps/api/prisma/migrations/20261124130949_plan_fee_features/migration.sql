-- Plans déjà en base (production : pas de seed) : ajoute les fonctions des frais de scolarité, sans doublon.
UPDATE "Plan" SET "features" = array_append("features", 'cashbox')
WHERE "code" IN ('ESSENTIEL', 'STANDARD', 'PREMIUM') AND NOT ('cashbox' = ANY("features"));

UPDATE "Plan" SET "features" = array_append("features", 'fee_tracking')
WHERE "code" IN ('STANDARD', 'PREMIUM') AND NOT ('fee_tracking' = ANY("features"));
