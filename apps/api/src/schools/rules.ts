// Règles métier pures (sans base de données), testées dans rules.spec.ts.
import type {
  BillingCycle,
  DocumentRequirement,
  Ownership,
  Plan,
  ReviewStatus,
  SchoolType,
  SubscriptionStatus,
  VerificationStatus,
} from '@prisma/client';

export const FEATURES = {
  CORE: 'core',
  HOMEWORK: 'homework',
  MESSAGING: 'messaging',
  FEE_PAYMENTS: 'fee_payments',
  CASHBOX: 'cashbox',
  CUSTOM_REPORT_CARDS: 'custom_report_cards',
  ADVANCED_STATS: 'advanced_stats',
  EXPORTS: 'exports',
  SMS: 'sms',
  PRIORITY_SUPPORT: 'priority_support',
  CUSTOM_THEME: 'custom_theme',
} as const;
export type Feature = (typeof FEATURES)[keyof typeof FEATURES];
export const ALL_FEATURES = Object.values(FEATURES) as string[];

/**
 * Ce que l'utilisateur veut faire :
 * - read : consulter ;
 * - write : saisir ou modifier des données de l'école ;
 * - publish : rendre visible aux élèves et parents, envoyer des messages ;
 * - invite : inviter enseignants, élèves, parents ;
 * - collect : encaisser les frais de scolarité.
 */
export type Need = 'read' | 'write' | 'publish' | 'invite' | 'collect';

export type Denial =
  | 'DISCOVERY'
  | 'SUSPENDED'
  | 'READ_ONLY'
  | 'PLAN'
  | 'NOT_VERIFIED'
  | 'DOCUMENT_OVERDUE';

export interface AccessInput {
  subscriptionStatus: SubscriptionStatus;
  verificationStatus: VerificationStatus;
  planFeatures: string[];
  hasOverdueDocument: boolean;
}

/** Renvoie la raison du refus, ou null si l'action est permise. */
export function checkAccess(
  s: AccessInput,
  need: Need,
  feature: string = FEATURES.CORE,
): Denial | null {
  if (s.subscriptionStatus === 'SUSPENDED') return 'SUSPENDED';
  if (s.subscriptionStatus === 'DISCOVERY') return 'DISCOVERY';
  if (s.subscriptionStatus === 'READ_ONLY') {
    return need === 'read' ? null : 'READ_ONLY';
  }
  if (!s.planFeatures.includes(feature)) return 'PLAN';
  if (need === 'read' || need === 'write') return null;
  if (s.verificationStatus !== 'VERIFIED') return 'NOT_VERIFIED';
  if ((need === 'invite' || need === 'collect') && s.hasOverdueDocument) {
    return 'DOCUMENT_OVERDUE';
  }
  return null;
}

export interface SchoolProfile {
  country: string;
  type: SchoolType;
  ownership: Ownership | null;
  verifiedAt: Date | null;
}

type Req = Pick<
  DocumentRequirement,
  | 'isActive'
  | 'isMandatory'
  | 'countries'
  | 'schoolTypes'
  | 'ownerships'
  | 'appliesToExisting'
  | 'dueDate'
  | 'createdAt'
>;

/** La pièce est-elle demandée à cette école ? */
export function requirementApplies(req: Req, school: SchoolProfile): boolean {
  if (!req.isActive) return false;
  if (req.countries.length && !req.countries.includes(school.country)) {
    return false;
  }
  if (req.schoolTypes.length && !req.schoolTypes.includes(school.type)) {
    return false;
  }
  // Statut pas encore renseigné : on demande la pièce par prudence.
  if (
    req.ownerships.length &&
    school.ownership &&
    !req.ownerships.includes(school.ownership)
  ) {
    return false;
  }
  // Pièce ajoutée après la vérification de l'école : seulement si le super admin l'a voulu.
  if (school.verifiedAt && req.createdAt > school.verifiedAt) {
    return req.appliesToExisting;
  }
  return true;
}

/** Pièce obligatoire, exigée d'une école existante, non fournie à la date limite. */
export function isOverdue(
  req: Req,
  doc: { reviewStatus: ReviewStatus } | undefined,
  now: Date,
): boolean {
  if (!req.isMandatory || !req.appliesToExisting || !req.dueDate) return false;
  if (req.dueDate > now) return false;
  return !doc || doc.reviewStatus === 'REJECTED';
}

/** Montant d'un abonnement. À l'année scolaire, les mois offerts sont déduits. */
export function amountFor(
  plan: Pick<
    Plan,
    'priceMonthly' | 'schoolYearMonths' | 'schoolYearFreeMonths'
  >,
  cycle: BillingCycle,
): number {
  if (cycle === 'MONTHLY') return plan.priceMonthly;
  return (
    plan.priceMonthly * (plan.schoolYearMonths - plan.schoolYearFreeMonths)
  );
}

/** Période couverte. Un renouvellement anticipé prolonge l'abonnement en cours. */
export function periodFor(
  cycle: BillingCycle,
  months: number,
  now: Date,
  currentEnd: Date | null,
): { start: Date; end: Date } {
  const start = currentEnd && currentEnd > now ? currentEnd : now;
  const end = new Date(start);
  end.setMonth(end.getMonth() + (cycle === 'MONTHLY' ? 1 : months));
  return { start, end };
}

const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'app',
  'admin',
  'platform',
  'mail',
  'static',
  'cdn',
  'demo',
  'decouverte',
  'support',
  'aide',
  'blog',
  'status',
  'soukoulou',
]);
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export function isSlugAllowed(slug: string): boolean {
  return (
    SLUG_PATTERN.test(slug) && !slug.includes('--') && !RESERVED_SLUGS.has(slug)
  );
}

/** Vérifie que le contenu du fichier correspond bien à son type annoncé. */
export function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-')
    return 'application/pdf';
  if (
    buf
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'image/jpeg';
  return null;
}

/** Luminance relative WCAG d'une couleur #RRGGBB. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste entre le texte blanc et la couleur d'accent (WCAG : 4,5 minimum). */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
