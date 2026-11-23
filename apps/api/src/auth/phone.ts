/**
 * Numéro de téléphone normalisé pour servir d'identifiant : « +22890079190 ».
 * Accepte espaces, tirets, points, préfixe 00 ; un numéro local à 8 chiffres est considéré togolais.
 * null si ce n'est pas un numéro plausible.
 */
// ponytail: indicatif par défaut +228 ; prendre le pays de l'école quand d'autres pays arriveront.
export function normalizePhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s.\-()]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (/^\d{8}$/.test(s)) s = `+228${s}`;
  return /^\+\d{8,15}$/.test(s) ? s : null;
}

/** Code de première connexion : 10 caractères sans ambiguïté de lecture (pas de 0/O, 1/l/I). */
export function tempCode(random: (n: number) => Buffer): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return [...random(10)].map((b) => alphabet[b % alphabet.length]).join('');
}
