import type { Onboarding } from "./types";

/** Avancement de l'upgrade : informations, pièces, paiement. */
export function upgradeProgress({ school, requirements }: Onboarding) {
  const info = Boolean(school.ownership && school.authorizationNumber && school.address && school.desiredSlug);
  const mandatory = requirements.filter((r) => r.isMandatory);
  const sent = mandatory.filter((r) => r.document && r.document.reviewStatus !== "REJECTED").length;
  const documents = sent === mandatory.length;
  const paid = school.subscriptionStatus !== "DISCOVERY";
  return { info, documents, paid, sent, total: mandatory.length };
}
