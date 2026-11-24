import type {
  DisciplineKind,
  Ownership,
  PaymentMethod,
  ReviewStatus,
  SchoolType,
  SubscriptionStatus,
  VerificationStatus,
} from "./types";

export const money = (n: number, currency = "XOF") =>
  `${new Intl.NumberFormat("fr-FR").format(n)} ${currency === "XOF" ? "FCFA" : currency}`;

/** URL du logo d'une école ; `v` change à chaque nouveau logo (cache long). */
export const logoUrl = (schoolId: string, v: string | null) => (v ? `/photos/logo/${schoolId}?v=${v}` : null);

export const date = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(d)) : "—";

export const dateTime = (d: string | Date) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lome",
  }).format(new Date(d));

/** « vendredi 6 novembre 2026 » : date du jour, rendue côté serveur. */
export const todayLabel = () =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lome" }).format(new Date());

/** « 2026-11-06 » : jour courant au Togo. */
export const todayISO = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lome" }).format(new Date());

/** « il y a 3 h », « il y a 2 j ». */
export function ago(d: string | Date): string {
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "à l’instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export const daysUntil = (d: string | Date) =>
  Math.max(0, Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000));

export const SCHOOL_TYPES: Record<SchoolType, string> = {
  PRIMARY: "École primaire",
  MIDDLE: "Collège",
  HIGH: "Lycée",
  COMPLEX: "Complexe scolaire",
  INSTITUTE: "Institut",
};

export const OWNERSHIPS: Record<Ownership, string> = {
  PUBLIC: "Public",
  PRIVATE_SECULAR: "Privé laïc",
  PRIVATE_FAITH: "Privé confessionnel",
};

export const SUBSCRIPTION: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  DISCOVERY: { label: "Découverte", tone: "neutral" },
  ACTIVE: { label: "Actif", tone: "success" },
  READ_ONLY: { label: "Lecture seule", tone: "warning" },
  SUSPENDED: { label: "Suspendu", tone: "danger" },
};

export const VERIFICATION: Record<VerificationStatus, { label: string; tone: Tone }> = {
  NOT_SUBMITTED: { label: "Pièces non envoyées", tone: "neutral" },
  PENDING: { label: "En vérification", tone: "info" },
  CHANGES_REQUESTED: { label: "À corriger", tone: "warning" },
  VERIFIED: { label: "Vérifiée", tone: "success" },
  REJECTED: { label: "Refusée", tone: "danger" },
};

export const REVIEW: Record<ReviewStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "En vérification", tone: "info" },
  ACCEPTED: { label: "Conforme", tone: "success" },
  REJECTED: { label: "À remplacer", tone: "danger" },
};

export const METHODS: Record<PaymentMethod, string> = {
  MOBILE_MONEY: "Mobile Money",
  CARD: "Carte bancaire",
  TRANSFER: "Virement ou dépôt",
};

export const FEE_METHODS = { CASH: "Espèces", MOBILE_MONEY: "Mobile Money", CARD: "Carte bancaire" } as const;

export const PAYOUT_STATUS: Record<"REQUESTED" | "PAID" | "REJECTED", { label: string; tone: Tone }> = {
  REQUESTED: { label: "Demandé", tone: "info" },
  PAID: { label: "Versé", tone: "success" },
  REJECTED: { label: "Rejeté", tone: "danger" },
};

/** « AAAA-MM-JJ » (ou ISO) → « 5 janvier 2027 », sans décalage de fuseau. */
export const dayLabel = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(d.slice(0, 10)));

export const FEATURE_LABELS: Record<string, string> = {
  core: "Élèves, classes, notes, bulletins, discipline, annonces",
  homework: "Cahier de textes",
  messaging: "Messagerie école ↔ parents",
  fee_payments: "Paiement des frais par Mobile Money",
  cashbox: "Caisse, reçus et soldes des frais de scolarité",
  fee_tracking: "Frais en plusieurs tranches, relances et tableau de bord",
  custom_report_cards: "Bulletins personnalisés",
  advanced_stats: "Statistiques avancées",
  exports: "Exports Excel et PDF",
  sms: "SMS aux parents",
  priority_support: "Support prioritaire",
  custom_theme: "Couleur personnalisée de l’école",
};

export const COUNTRIES: Record<string, string> = {
  TG: "Togo",
  BJ: "Bénin",
  CI: "Côte d’Ivoire",
  BF: "Burkina Faso",
  SN: "Sénégal",
  ML: "Mali",
  NE: "Niger",
  GN: "Guinée",
  CM: "Cameroun",
  GA: "Gabon",
};

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Lien d'un parent avec l'élève. */
export const RELATIONS: Record<"FATHER" | "MOTHER" | "GUARDIAN", string> = {
  FATHER: "Père",
  MOTHER: "Mère",
  GUARDIAN: "Tuteur",
};

export const AUDIENCES: Record<"TEACHER" | "PARENT" | "STUDENT", string> = {
  STUDENT: "Élèves",
  PARENT: "Parents",
  TEACHER: "Enseignants",
};

export const DISCIPLINE: Record<DisciplineKind, { label: string; tone: Tone }> = {
  MERIT: { label: "Mérite", tone: "success" },
  PUNISHMENT: { label: "Punition", tone: "warning" },
  BLAME: { label: "Blâme", tone: "danger" },
};
