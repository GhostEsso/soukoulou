// Types des réponses de l'API Soukoulou (apps/api).

export type SubscriptionStatus = "DISCOVERY" | "ACTIVE" | "READ_ONLY" | "SUSPENDED";
export type VerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "CHANGES_REQUESTED"
  | "VERIFIED"
  | "REJECTED";
export type ReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED";
export type SchoolType = "PRIMARY" | "MIDDLE" | "HIGH" | "COMPLEX" | "INSTITUTE";
export type Ownership = "PUBLIC" | "PRIVATE_SECULAR" | "PRIVATE_FAITH";
export type BillingCycle = "MONTHLY" | "SCHOOL_YEAR";
export type PaymentMethod = "MOBILE_MONEY" | "CARD" | "TRANSFER";
export type Need = "read" | "write" | "publish" | "invite" | "collect" | "payout";
export type Denial =
  | "DISCOVERY"
  | "SUSPENDED"
  | "READ_ONLY"
  | "PLAN"
  | "NOT_VERIFIED"
  | "DOCUMENT_OVERDUE";

export interface Me {
  id: string;
  email: string | null;
  loginPhone: string | null;
  mustChangePassword: boolean;
  firstName: string;
  lastName: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  memberships: {
    role: string;
    title: string | null;
    school: {
      id: string;
      name: string;
      slug: string | null;
      subscriptionStatus: SubscriptionStatus;
      verificationStatus: VerificationStatus;
      brandColor: string | null;
    };
  }[];
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  priceMonthly: number;
  currency: string;
  schoolYearMonths: number;
  schoolYearFreeMonths: number;
  features: string[];
  rank?: number;
  isActive?: boolean;
}

export interface School {
  id: string;
  name: string;
  slug: string | null;
  desiredSlug: string | null;
  type: SchoolType;
  ownership: Ownership | null;
  country: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  authorizationNumber: string | null;
  approxStudentCount: number | null;
  subscriptionStatus: SubscriptionStatus;
  verificationStatus: VerificationStatus;
  discoveryExpiresAt: string | null;
  verifiedAt: string | null;
  planId: string | null;
  plan: Plan | null;
  subscriptionEndsAt: string | null;
  suspendedReason: string | null;
  brandColor: string | null;
  createdAt: string;
}

export interface RequirementStatus {
  id: string;
  name: string;
  description: string | null;
  isMandatory: boolean;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  dueDate: string | null;
  overdue: boolean;
  document: {
    id: string;
    originalName: string;
    reviewStatus: ReviewStatus;
    reviewComment: string | null;
    uploadedAt: string;
  } | null;
}

export interface Onboarding {
  school: School;
  requirements: RequirementStatus[];
  access: Record<Need, Denial | null>;
}

export interface Alert {
  id: string;
  type: "NEW_VERIFICATION" | "RESUBMITTED" | "DOCUMENT_UPLOADED" | "PAYMENT_TO_CONFIRM";
  readAt: string | null;
  createdAt: string;
  school: { id: string; name: string; city: string; country: string };
}

export interface SchoolEvent {
  id: string;
  action: string;
  actorId: string | null;
  documentId: string | null;
  message: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  billingCycle: BillingCycle;
  paidAt: string | null;
  periodEnd: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

export interface VerificationDetail {
  school: School & {
    memberships: {
      title: string | null;
      user: { id: string; email: string; firstName: string; lastName: string; phone: string | null };
    }[];
    documents: {
      id: string;
      requirementId: string;
      originalName: string;
      mimeType: string;
      reviewStatus: ReviewStatus;
      reviewComment: string | null;
      uploadedAt: string;
      requirement: { name: string; checkpoints: string[]; isMandatory: boolean };
    }[];
    events: SchoolEvent[];
    payments: Payment[];
  };
  requirements: RequirementStatus[];
  duplicates: {
    id: string;
    name: string;
    city: string;
    subscriptionStatus: SubscriptionStatus;
    verificationStatus: VerificationStatus;
  }[];
}

export interface DocumentRequirement {
  id: string;
  name: string;
  description: string | null;
  isMandatory: boolean;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  countries: string[];
  schoolTypes: SchoolType[];
  ownerships: Ownership[];
  checkpoints: string[];
  isActive: boolean;
  appliesToExisting: boolean;
  dueDate: string | null;
  createdAt: string;
}

export interface SchoolCalendar {
  id: string;
  country: string;
  schoolYearLabel: string;
  startsOn: string;
  endsOn: string;
}

// ── Structure de l'école ─────────────────────────────────

export type PeriodType = "TRIMESTER" | "SEMESTER";

export interface Period {
  id: string;
  name: string;
  position: number;
  startsOn: string;
  endsOn: string;
}

export interface AcademicYear {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  periodType: PeriodType;
  isCurrent: boolean;
  periods: Period[];
  _count: { classrooms: number };
}

export interface Level {
  id: string;
  name: string;
  position: number;
  subjects: { subjectId: string; name: string; coefficient: number }[];
  _count: { classrooms: number };
}

export interface Subject {
  id: string;
  name: string;
  shortName: string | null;
  _count: { levels: number };
}

export interface Classroom {
  id: string;
  yearId: string;
  levelId: string;
  name: string;
  capacity: number | null;
  level: { name: string };
}

export interface Structure {
  years: AcademicYear[];
  levels: Level[];
  subjects: Subject[];
  classrooms: Classroom[];
}

// ── Élèves ───────────────────────────────────────────────

export type Sex = "MALE" | "FEMALE";

export interface Student {
  photo: string | null;
  id: string;
  matricule: string | null;
  firstName: string;
  lastName: string;
  sex: Sex;
  birthDate: string | null;
  classroom: { id: string; name: string } | null;
}

export interface StudentPage {
  total: number;
  page: number;
  pageSize: number;
  yearId: string | null;
  items: Student[];
}

export interface StudentStats {
  yearId: string | null;
  total: number;
  male: number;
  female: number;
  byClassroom: { classroomId: string; male: number; female: number }[];
}

// ── Présences ────────────────────────────────────────────

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export interface Roster {
  day: string;
  classroom: { id: string; name: string };
  taken: boolean;
  students: { id: string; firstName: string; lastName: string; sex: Sex; matricule: string | null; status: AttendanceStatus | null }[];
}

export interface AttendanceDay {
  day: string;
  present: number;
  absent: number;
  late: number;
}

// ── Enseignants ──────────────────────────────────────────

export interface Teacher {
  /** Version de la photo de profil (null : pas de photo). */
  photo: string | null;
  id: string;
  matricule: string | null;
  firstName: string;
  lastName: string;
  sex: Sex | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string }[];
}

export interface TeacherDetail extends Teacher {
  account: SchoolAccount | null;
  teachings: { id: string; classroom: { id: string; name: string }; subject: { id: string; name: string } }[];
}

export interface TeacherPage {
  total: number;
  page: number;
  pageSize: number;
  items: Teacher[];
}

export interface Assignment {
  classroomId: string;
  subjectId: string;
  teacherId: string;
  teacherName: string;
}

export interface Slot {
  id: string;
  weekday: number; // 1 = lundi … 6 = samedi
  start: string; // « 08:00 »
  end: string;
  room: string | null;
  teachingId: string;
  classroom: { id: string; name: string };
  subject: { id: string; name: string; shortName: string | null };
  teacher: { id: string; name: string };
}

export interface Assessment {
  id: string;
  title: string;
  day: string;
  maxScore: number;
  classroom: { id: string; name: string };
  subject: { id: string; name: string };
  period: { id: string; name: string };
  teacher: { id: string; name: string } | null;
  graded: number;
  average: number | null;
}

export interface AssessmentDetail extends Omit<Assessment, "graded"> {
  students: { id: string; firstName: string; lastName: string; matricule: string | null; score: number | null }[];
}

export interface Performance {
  average: number | null;
  grades: number;
  assessments: number;
  periods: { id: string; name: string; average: number | null }[];
}

export interface StudentDetail extends Omit<Student, "classroom"> {
  account: SchoolAccount | null;
  classroom: { id: string; name: string; level: { name: string } } | null;
  parents: { id: string; firstName: string; lastName: string; phone: string; email: string | null; relation: ParentRelation }[];
}

export interface StudentAttendance {
  present: number;
  absent: number;
  late: number;
  rate: number | null; // % de jours présents (retards compris)
  recent: { day: string; status: AttendanceStatus }[];
}

export interface ReportPeriod {
  id: string;
  name: string;
  average: number | null;
  rank: number | null;
  ranked: number;
  subjects: {
    id: string;
    name: string;
    coefficient: number;
    average: number | null;
    grades: { id: string; title: string; day: string; maxScore: number; score: number | null }[];
  }[];
}

export interface ReportCards {
  school: { name: string; country: string; city: string; address: string | null; phone: string | null; email: string | null };
  year: string;
  classroom: { id: string; name: string; level: string };
  period: { id: string; name: string };
  /** Bilan annuel : moyennes = moyenne des périodes, colonnes par période dans `periods`. */
  annual: boolean;
  periods: { id: string; name: string }[];
  stats: { size: number; ranked: number; average: number | null; max: number | null; min: number | null };
  totalCoefficient: number;
  students: {
    id: string;
    firstName: string;
    lastName: string;
    matricule: string | null;
    sex: Sex;
    birthDate: string | null;
    average: number | null;
    rank: number | null;
    mention: string | null;
    absences: number;
    lates: number;
    periodAverages: (number | null)[];
    suggestion: CouncilDecision | null;
    council: { comment: string | null; decision: CouncilDecision | null };
    subjects: {
      id: string;
      name: string;
      coefficient: number;
      teacher: string | null;
      average: number | null;
      points: number | null;
      rank: number | null;
      appreciation: string | null;
      periodAverages: (number | null)[];
    }[];
  }[];
}

export type CouncilDecision = "PROMOTED" | "REPEATING";

export type ParentRelation = "FATHER" | "MOTHER" | "GUARDIAN";

export interface ParentChild {
  id: string;
  firstName: string;
  lastName: string;
  relation: ParentRelation;
  classroom: { id: string; name: string } | null;
}

export interface Parent {
  account: SchoolAccount | null;
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string | null;
  profession: string | null;
  children: ParentChild[];
}

export interface ParentPage {
  total: number;
  page: number;
  pageSize: number;
  items: Parent[];
}

/** Accès de l'enseignant à son espace (null : pas d'accès). */
export interface SchoolAccount {
  phone: string | null;
  /** Code de première connexion pas encore remplacé. */
  pending: boolean;
}

/** Espace enseignant : sa fiche, ses cours et son emploi du temps. */
export interface TeacherHome {
  id: string;
  firstName: string;
  lastName: string;
  school: { name: string };
  teachings: { classroom: { id: string; name: string }; subject: { id: string; name: string } }[];
  slots: Slot[];
}

/** Espace parent : ses enfants et leur classe de l'année. */
export interface ParentHome {
  firstName: string;
  lastName: string;
  school: { name: string };
  children: {
    id: string;
    firstName: string;
    lastName: string;
    sex: Sex;
    matricule: string | null;
    photo: string | null;
    relation: ParentRelation;
    classroom: { id: string; name: string } | null;
  }[];
}

export interface ChildFollowUp {
  child: Omit<ParentHome["children"][number], "relation">;
  report: { periods: ReportPeriod[] };
  attendance: StudentAttendance;
  slots: Slot[];
  discipline: DisciplineRecord[];
  /** Frais de scolarité (espace parent) : null sans grille applicable. */
  fees?: ChildFees | null;
}

export type DisciplineKind = "MERIT" | "PUNISHMENT" | "BLAME";

export interface DisciplineRecord {
  id: string;
  kind: DisciplineKind;
  reason: string;
  /** « AAAA-MM-JJ ». */
  day: string;
}

/** Espace élève : son propre suivi. */
export interface StudentHome extends ChildFollowUp {
  school: { name: string };
}

export type Audience = "TEACHER" | "PARENT" | "STUDENT";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** Absent dans le fil d'un espace (il ne voit que les siennes). */
  audiences?: Audience[];
  createdAt: string;
}

/** Évaluation vue par l'élève (sa note si elle est passée). */
export interface MyExam {
  id: string;
  title: string;
  day: string;
  maxScore: number;
  subject: string;
  period: string;
  score: number | null;
}

// ── Frais de scolarité ───────────────────────────────────

export interface FeeSchedule {
  id: string;
  label: string | null;
  sex: Sex | null;
  levels: { id: string; name: string }[];
  /** « AAAA-MM-JJ ». */
  lines: { position: number; amount: number; dueOn: string }[];
}

export interface FeeBalance {
  studentId: string;
  name: string;
  classroom: string | null;
  due: number;
  paid: number;
  remaining: number;
  overdue: boolean;
}

export interface FeeLine {
  position: number;
  amount: number;
  paid: number;
  remaining: number;
  dueOn: string;
  overdue: boolean;
}

export type FeeMethod = "CASH" | "MOBILE_MONEY" | "CARD";

export interface FeePaymentRow {
  id: string;
  amount: number;
  method: FeeMethod;
  receiptNumber: string | null;
  paidAt: string;
}

export interface ChildFees {
  label: string;
  /** Espace parent : paiement en ligne ouvert (offre de l'école et prestataire configuré). */
  canPay?: boolean;
  lines: FeeLine[];
  payments: FeePaymentRow[];
}

export interface FeeDashboard {
  due: number;
  collected: number;
  remaining: number;
  overdue: number;
  byClassroom: { classroomId: string | null; classroom: string | null; due: number; collected: number; remaining: number; overdue: number }[];
  online: { collected: number; available: number };
  recent: {
    id: string;
    paidAt: string | null;
    amount: number;
    method: FeeMethod;
    receiptNumber: string | null;
    studentId: string;
    student: string | null;
    classroom: string | null;
    payer: string | null;
    remainingAfter: number;
  }[];
}

export interface FeeReceipt {
  number: string | null;
  school: { name: string };
  student: { name: string };
  classroom: string | null;
  payer: string | null;
  payerRole: "parent" | "cashier" | null;
  amount: number;
  method: FeeMethod;
  paidAt: string;
  due: number;
  remaining: number;
}

export type PayoutStatus = "REQUESTED" | "PAID" | "REJECTED";

export interface Payout {
  id: string;
  amount: number;
  destination: string;
  status: PayoutStatus;
  providerRef: string | null;
  rejectReason: string | null;
  createdAt: string;
  processedAt: string | null;
  school?: { name: string };
}
