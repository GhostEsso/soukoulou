# Frais de scolarité — plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans. Les étapes utilisent des cases `- [ ]`.

**But :** l'école paramètre ses frais (par groupe de niveaux, par sexe, en tranches), encaisse en espèces ou en ligne, suit les soldes et les impayés, relance les parents et demande le décaissement des paiements en ligne.

**Architecture :** nouveau module NestJS `src/fees` (règles pures + services), à côté des modules existants. Le montant dû par élève est **figé** à l'inscription (`StudentFee`) : modifier la grille n'altère pas l'existant. Le prestataire de paiement reste abstrait : même schéma que l'abonnement (paiement `PENDING` + webhook signé HMAC + simulation en dev). Le décaissement est validé à la main par l'admin Soukoulou en v1.

**Stack :** NestJS 11, Prisma 6, PostgreSQL, Next.js 16 (server actions), Jest (unitaires `*.spec.ts`, e2e `test/*.e2e-spec.ts`).

**Spec :** décisions prises avec le porteur du projet (24/11/2026), reprises ici :

1. Grille par année scolaire. Une règle cible **plusieurs niveaux** (ex. 6e → 3e), un sexe optionnel (`null` = tous) et une liste de **tranches** (montant + date limite).
   Ex. : 6e-3e tous 40 000 ; ou 6e-3e filles 25 000 / garçons 40 000 ; 2nde-Tle tous 70 000.
2. Règle par sexe prioritaire sur la règle « tous » du même niveau.
3. Pas de réductions (bourses, fratrie…) en v1.
4. Un seul type de frais (« Scolarité ») en v1.
5. Tranches avec relances.
6. Caisse : paiement en espèces avec reçu numéroté. Paiement en ligne par le parent (Mobile Money / carte).
7. L'école voit les paiements dans un tableau de bord et **demande le décaissement** des sommes encaissées en ligne ; Soukoulou le traite.
8. Verrouillage par offre (voir Contraintes globales).

## Contraintes globales

- Montants en `Int`, unité de la devise de l'offre (FCFA, sans centimes). Montant de tranche ≥ 1.
- Fonctionnalités par offre (`FEATURES` dans `src/schools/rules.ts`) :
  - `cashbox` (Essentiel, Standard, Premium) : grille **à une seule tranche**, caisse, reçus, soldes élève et parent.
  - `fee_tracking` (nouveau ; Standard, Premium) : grille à plusieurs tranches, relances, tableau de bord.
  - `fee_payments` (Standard, Premium) : paiement en ligne par les parents, décaissements.
- Encaisser en espèces = besoin `write` + `cashbox`. Paiement en ligne et décaissement = besoin `collect` + `fee_payments` (exige école vérifiée, sans pièce en retard : déjà géré par `checkAccess`).
- Tout est filtré par `schoolId` ; un parent n'accède qu'aux enfants liés par `ParentChild`.
- Messages d'erreur en français, style du code existant. Fichiers < 500 lignes.
- Commits sans mention d'outil ni `Co-Authored-By`.
- Le `@Cron` interne et `POST /internal/daily` appellent déjà `LifecycleService.runDaily` : les relances s'y branchent, rien d'autre à planifier.

## Points de vigilance (non couverts par la spec)

1. **Règles qui se chevauchent** : deux règles « tous » (ou deux « filles ») sur un même niveau la même année → refus 400 « Le niveau 5e a déjà des frais pour ce public. ». Test dans la tâche 3.
2. **Élève sans règle applicable** : pas de `StudentFee`, solde affiché « Aucun frais » (pas d'erreur). Test dans la tâche 3.
3. **Paiement supérieur au reste à payer** : refus 400 (caisse) ; en ligne, le montant demandé est plafonné au reste à payer au moment du checkout. Tests tâches 4 et 6.
4. **Webhook rejoué ou arrivé deux fois** : idempotent, le paiement n'est compté qu'une fois. Test tâche 6.
5. **Deux demandes de décaissement simultanées** dépassant le disponible : transaction `Serializable`, une seule passe. Test tâche 7.

---

## Fichiers

**API (`apps/api`)**
- Modifier : `prisma/schema.prisma` (modèles ci-dessous), `prisma/seed.ts` (offres), `prisma/seed-demo.ts` (grille de démo Les Palmiers)
- Modifier : `src/schools/rules.ts` (`FEATURES.FEE_TRACKING`), `src/schools/lifecycle.service.ts` (appel des relances), `src/app.module.ts` (import `FeesModule`)
- Modifier : `src/students/students.service.ts` (création du `StudentFee` à l'inscription)
- Modifier : `src/family-space/parent-space.controller.ts` (solde de l'enfant, checkout)
- Modifier : `src/platform/platform.controller.ts`, `src/platform/platform.service.ts` (décaissements)
- Créer : `src/fees/rules.ts` + `rules.spec.ts` (fonctions pures), `src/fees/dto.ts`, `src/fees/fees.service.ts` (grille, soldes, caisse, tableau de bord), `src/fees/online.service.ts` (checkout, webhook, décaissements), `src/fees/reminders.ts` (relances), `src/fees/fees.controller.ts`, `src/fees/fees.module.ts`
- Créer : `test/fees.e2e-spec.ts`

**Web (`apps/web`)** — suivre les motifs de `(scolarite)` (`list.tsx`, `dialogs.tsx`, `actions.ts`) et de `admin/paiements`
- Créer : `src/app/ecole/[schoolId]/(scolarite)/frais/page.tsx` (grille), `frais/eleves/page.tsx` (soldes), `frais/eleves/[studentId]/page.tsx` (détail + encaisser), `frais/tableau-de-bord/page.tsx`, `frais/decaissements/page.tsx`, `frais/actions.ts`
- Créer : `src/app/impression/[schoolId]/recu/[paymentId]/page.tsx` (reçu imprimable)
- Modifier : `src/app/parent/[schoolId]/enfants/…` (tranches, solde, bouton « Payer »), `src/app/admin/…` (onglet Décaissements), navigation de l'app (`components/app-shell.tsx`)

## Modèle de données

```prisma
enum PaymentMethod { MOBILE_MONEY CARD TRANSFER CASH }   // + CASH
enum PayoutStatus { REQUESTED PAID REJECTED }
enum ReminderKind { DUE_SOON OVERDUE }

model FeeSchedule {            // une règle de la grille
  id       String   @id @default(cuid())
  schoolId String
  yearId   String
  label    String   @default("Scolarité")
  sex      Sex?     // null = tous
  levels   Level[]  // relation implicite n-n
  lines    FeeScheduleLine[]
  createdAt DateTime @default(now())
  @@index([schoolId, yearId])
}
model FeeScheduleLine { id String @id @default(cuid()); scheduleId String; position Int; amount Int; dueOn DateTime @db.Date
  @@unique([scheduleId, position]) }

model StudentFee {             // montant figé pour un élève et une année
  id String @id @default(cuid()); schoolId String; studentId String; yearId String
  scheduleId String?           // SetNull si la règle est supprimée
  label String; lines StudentFeeLine[]; payments FeePayment[]; reminders FeeReminder[]
  createdAt DateTime @default(now())
  @@unique([studentId, yearId]) @@index([schoolId, yearId])
}
model StudentFeeLine { id String @id @default(cuid()); studentFeeId String; position Int; amount Int; dueOn DateTime @db.Date
  @@unique([studentFeeId, position]) }

model FeePayment {
  id String @id @default(cuid()); schoolId String; studentFeeId String
  amount Int; method PaymentMethod; status PaymentStatus @default(PENDING)
  provider String?; providerRef String? @unique
  receiptNumber String?        // « REC-2026-000042 », attribué au passage à PAID
  recordedById String?         // caissier (espèces)
  parentId String?             // payeur (en ligne)
  paidAt DateTime?; createdAt DateTime @default(now())
  @@unique([schoolId, receiptNumber]) @@index([schoolId, status])
}

model Payout {                 // demande de décaissement
  id String @id @default(cuid()); schoolId String; amount Int
  destination String           // numéro Mobile Money ou RIB saisi par l'école
  status PayoutStatus @default(REQUESTED)
  requestedById String; processedById String?; providerRef String?; rejectReason String?
  createdAt DateTime @default(now()); processedAt DateTime?
  @@index([status])
}

model FeeReminder {            // une relance envoyée : empêche les doublons
  id String @id @default(cuid()); studentFeeId String; position Int; kind ReminderKind
  sentAt DateTime @default(now())
  @@unique([studentFeeId, position, kind])
}
// School : + receiptSeq Int @default(0)   (compteur de reçus, incrément atomique)
```

Toutes les relations vers `School`, `Student`, `StudentFee` en `onDelete: Cascade`, sauf `StudentFee.scheduleId` (`SetNull`).

---

### Tâche 1 : Schéma, offres et fonctionnalité `fee_tracking`

**Fichiers :** `prisma/schema.prisma`, `prisma/seed.ts`, `src/schools/rules.ts`, `src/schools/rules.spec.ts`

**Interfaces :** produit les modèles Prisma ci-dessus et `FEATURES.FEE_TRACKING = 'fee_tracking'`.

- [ ] Ajouter au test de `rules.spec.ts` : `expect(ALL_FEATURES).toContain('fee_tracking')`. Lancer `pnpm --filter api test -- rules` → ÉCHEC.
- [ ] Ajouter `FEE_TRACKING` à `FEATURES`. Dans `seed.ts` : `ESSENTIEL = [F.CORE, F.CASHBOX]`, `STANDARD = [...ESSENTIEL, F.HOMEWORK, F.MESSAGING, F.FEE_TRACKING, F.FEE_PAYMENTS]` (le seed met déjà à jour `features` des offres existantes).
- [ ] Écrire le schéma, puis `pnpm --filter api exec prisma migrate dev --name frais_de_scolarite`. Relancer les tests → SUCCÈS.
- [ ] Commit `Frais de scolarité : schéma et fonctionnalités par offre`.

### Tâche 2 : Règles pures

**Fichiers :** `src/fees/rules.ts`, `src/fees/rules.spec.ts`

**Interfaces (produit) :**
```ts
type Line = { position: number; amount: number; dueOn: Date };
type Rule = { id: string; sex: Sex | null; levelIds: string[]; lines: Line[] };
resolveSchedule(rules: Rule[], levelId: string, sex: Sex): Rule | null
findOverlap(rules: Rule[], candidate: Omit<Rule, 'id'> & { id?: string }): string | null   // levelId en conflit
validateLines(lines: Line[], maxLines: number): string | null                              // message d'erreur ou null
allocate(lines: Line[], paid: number, now: Date): { position; amount; paid; remaining; dueOn; overdue: boolean }[]
remindersDue(alloc: ReturnType<typeof allocate>, now: Date): { position: number; kind: ReminderKind }[]
receiptNumber(year: number, seq: number): string
availableForPayout(onlinePaid: number, payouts: { amount: number; status: PayoutStatus }[]): number
```

- [ ] Tests (valeurs exactes) :
  - `resolveSchedule` : règles {tous 6e-3e 40 000} + {filles 6e-3e 25 000} → fille de 5e = règle filles ; garçon de 5e = règle tous ; élève de 2nde sans règle = `null`.
  - `findOverlap` : deux règles `sex: null` partageant la 5e → `'<id 5e>'` ; une `null` + une `FEMALE` → `null` ; en édition, la règle ne se chevauche pas avec elle-même.
  - `validateLines` : 0 tranche → « Au moins une tranche. » ; montant 0 → « Montant invalide. » ; dates non croissantes → « Les dates des tranches doivent se suivre. » ; 3 tranches avec `maxLines = 1` → « Plusieurs tranches : offre Standard. ».
  - `allocate` : tranches 20 000 (1/10) + 20 000 (1/01), payé 25 000, au 15/01 → [{paid 20 000, remaining 0, overdue false}, {paid 5 000, remaining 15 000, overdue true}].
  - `remindersDue` : tranche impayée échéant dans 7 jours → `DUE_SOON` ; échue depuis 1 jour → `OVERDUE` ; tranche soldée → rien.
  - `receiptNumber(2026, 42)` → `'REC-2026-000042'`.
  - `availableForPayout(100 000, [{30 000, PAID}, {20 000, REQUESTED}, {10 000, REJECTED}])` → `50 000`.
- [ ] `pnpm --filter api test -- fees/rules` → ÉCHEC, implémenter, → SUCCÈS.
- [ ] Commit `Frais de scolarité : règles pures (grille, tranches, allocation, relances)`.

### Tâche 3 : Grille et montants figés par élève

**Fichiers :** `src/fees/dto.ts`, `src/fees/fees.service.ts`, `src/fees/fees.controller.ts`, `src/fees/fees.module.ts`, `src/app.module.ts`, `src/students/students.service.ts`, `test/fees.e2e-spec.ts`

**Interfaces (produit) :**
- `FeesService.listSchedules(schoolId, yearId)`, `createSchedule(schoolId, dto: ScheduleDto)`, `updateSchedule(schoolId, id, dto)`, `deleteSchedule(schoolId, id)`
- `ScheduleDto { yearId: string; label?: string; sex: 'MALE' | 'FEMALE' | null; levelIds: string[]; lines: { amount: number; dueOn: 'YYYY-MM-DD' }[] }`
- `FeesService.applySchedules(schoolId, yearId): Promise<{ created: number }>` : crée le `StudentFee` (copie des tranches) de chaque élève inscrit qui n'en a pas et a une règle applicable. Appelé après chaque création ou modification de règle, et à l'inscription d'un élève (`students.service.ts`, même transaction ou juste après).
- Routes (`assertSchoolAdmin` + `can(s, 'write', FEATURES.CASHBOX)` pour écrire) : `GET/POST schools/:s/fees/schedules`, `PATCH/DELETE schools/:s/fees/schedules/:id`.
- `maxLines` = 1 sans `fee_tracking`, sinon 12.

- [ ] Tests e2e (`fees.e2e-spec.ts`, même montage que `onboarding.e2e-spec.ts`, école active vérifiée en Standard) :
  - créer {6e-3e tous, 2 tranches de 20 000} → 201 ; un élève de 5e inscrit obtient un dû de 40 000 en 2 tranches ;
  - créer une 2e règle « tous » sur la 5e → 400 « Le niveau 5e a déjà des frais pour ce public. » ;
  - modifier la règle à 50 000 → l'élève déjà inscrit reste à 40 000 ; un élève inscrit ensuite a 50 000 ;
  - élève de 2nde sans règle → aucun `StudentFee` ;
  - école en Essentiel : règle à 2 tranches → 400 « Plusieurs tranches : offre Standard. ».
- [ ] Lancer `pnpm test:api -- fees` → ÉCHEC, implémenter, → SUCCÈS.
- [ ] Commit `Frais de scolarité : grille et montants figés par élève`.

### Tâche 4 : Caisse, soldes, reçus, tableau de bord

**Fichiers :** `src/fees/fees.service.ts`, `src/fees/fees.controller.ts`, `src/fees/dto.ts`, `test/fees.e2e-spec.ts`

**Interfaces (produit) :**
- `FeesService.balances(schoolId, q: { yearId?; classroomId?; status?: 'unpaid' | 'overdue' | 'paid' })` → `{ studentId, name, classroom, due, paid, remaining, overdue: boolean }[]` (`paid` = somme des `FeePayment` `PAID`).
- `FeesService.studentFee(schoolId, studentId, yearId?)` → `{ label, lines: allocate(...), payments: { id, amount, method, receiptNumber, paidAt }[] } | null`
- `FeesService.recordCash(schoolId, userId, dto: CashDto { studentId: string; amount: number })` → paiement `PAID`, `method CASH`, numéro de reçu via `School.receiptSeq` incrémenté dans la même transaction.
- `FeesService.receipt(schoolId, paymentId)` → données du reçu (école, élève, classe, montant, numéro, date, reste à payer).
- `FeesService.dashboard(schoolId, yearId)` → `{ due, collected, remaining, overdue, byClassroom: {...}[] , online: { collected, available } }` (route protégée par `fee_tracking`).
- Routes : `GET schools/:s/fees/students`, `GET schools/:s/fees/students/:studentId`, `POST schools/:s/fees/payments`, `GET schools/:s/fees/payments/:id/receipt`, `GET schools/:s/fees/dashboard`.

- [ ] Tests e2e :
  - encaisser 25 000 sur 40 000 → 201, reçu `REC-<année>-000001`, solde 15 000 ; un 2e encaissement → `…000002` ;
  - encaisser 20 000 alors qu'il reste 15 000 → 400 « Le montant dépasse le reste à payer (15 000 FCFA). » ;
  - `status=overdue` liste l'élève quand la 2e tranche est échue et non soldée ;
  - tableau de bord en Essentiel → 403 `PLAN` ;
  - autre école : `GET …/payments/:id/receipt` → 404.
- [ ] ÉCHEC → implémenter → SUCCÈS. Commit `Frais de scolarité : caisse, reçus et tableau de bord`.

### Tâche 5 : Relances

**Fichiers :** `src/fees/reminders.ts`, `src/schools/lifecycle.service.ts`, `test/fees.e2e-spec.ts`

**Interfaces (produit) :** `sendFeeReminders(prisma: PrismaService, mail: MailService, now: Date): Promise<number>` (fonction, pas un service : `LifecycleService` l'appelle dans `runDaily` sans dépendance circulaire). Seulement les écoles dont l'offre contient `fee_tracking`. Pour chaque `remindersDue`, crée `FeeReminder` (l'unicité empêche les doublons) puis envoie un email aux parents liés qui ont un email : sujet « Frais de scolarité : tranche n°{n} à régler avant le {date} » (`DUE_SOON`) ou « Frais de scolarité : tranche n°{n} en retard » (`OVERDUE`), corps avec élève, montant restant, école.

- [ ] Tests e2e : `runDaily` 6 jours avant l'échéance → 1 email dans `mail.outbox` ; relancer `runDaily` le même jour → aucun nouvel email ; tranche soldée → aucun email.
- [ ] ÉCHEC → implémenter → SUCCÈS. Commit `Frais de scolarité : relances des tranches`.

### Tâche 6 : Paiement en ligne par le parent

**Fichiers :** `src/fees/online.service.ts`, `src/fees/fees.controller.ts`, `src/family-space/parent-space.controller.ts`, `test/fees.e2e-spec.ts`

**Interfaces (produit) :**
- `OnlineService.checkout(schoolId, parentUserId, studentId, amount: number)` → `{ paymentId, providerRef, checkoutUrl: null }` : vérifie le lien `ParentChild`, `can(s, 'collect', FEATURES.FEE_PAYMENTS)`, plafonne au reste à payer (400 si `amount` > reste), crée `FeePayment` `PENDING` `MOBILE_MONEY` avec `providerRef = id`. `checkoutUrl` restera `null` tant qu'aucun prestataire n'est branché.
- `OnlineService.handleWebhook(rawBody, signature, dto: { providerRef: string; status: 'PAID' | 'FAILED' })` : même vérification HMAC que `BillingService.handleWebhook` (`PAYMENT_WEBHOOK_SECRET`, en-tête `x-soukoulou-signature`). Passage `PENDING → PAID` par `updateMany where status PENDING` (idempotent), puis numéro de reçu.
- Routes : `POST schools/:s/parent/children/:studentId/fees/checkout` (parent), `POST webhooks/fee-payments` (`@Public()`), solde et tranches ajoutés à `GET schools/:s/parent/children/:studentId`.

- [ ] Tests e2e :
  - parent de l'élève : checkout 10 000 → 201 `PENDING` ; webhook signé `PAID` → solde réduit de 10 000 ; webhook rejoué → solde inchangé ;
  - webhook avec mauvaise signature → 401 ;
  - parent d'un autre élève → 404 ; école sans `fee_payments` → 403 `PLAN`.
- [ ] ÉCHEC → implémenter → SUCCÈS. Commit `Frais de scolarité : paiement en ligne des parents`.

### Tâche 7 : Décaissements

**Fichiers :** `src/fees/online.service.ts`, `src/fees/fees.controller.ts`, `src/platform/platform.controller.ts`, `src/platform/platform.service.ts`, `test/fees.e2e-spec.ts`

**Interfaces (produit) :**
- `OnlineService.requestPayout(schoolId, userId, dto: { amount: number; destination: string })` : transaction `Serializable` : disponible = `availableForPayout(somme des FeePayment PAID non CASH, payouts)` ; 400 « Montant supérieur au disponible ({n} FCFA). » sinon crée `Payout` `REQUESTED`.
- `OnlineService.listPayouts(schoolId)`.
- Plateforme : `GET platform/payouts?status=`, `POST platform/payouts/:id/paid { providerRef }`, `POST platform/payouts/:id/reject { reason }` (admin Soukoulou). Email au responsable de l'école à chaque changement d'état.
- Routes école : `GET/POST schools/:s/fees/payouts` (`collect` + `fee_payments`).

- [ ] Tests e2e : 10 000 payés en ligne ; demande de 6 000 → 201 ; deux demandes simultanées de 4 000 et 4 000 (`Promise.all`) → une 201, une 400 ; rejet de la 1re → 6 000 de nouveau disponibles ; marquer payé → statut `PAID`.
- [ ] ÉCHEC → implémenter → SUCCÈS. Commit `Frais de scolarité : demandes de décaissement`.

### Tâche 8 : Écrans école, parent et admin

**Fichiers :** pages web listées plus haut, `apps/api/prisma/seed-demo.ts`

- [ ] Grille : liste des règles de l'année, dialogue de création (niveaux à cocher, public « Tous / Filles / Garçons », tranches montant + date, bouton « Ajouter une tranche » masqué sans `fee_tracking`). Fonctionnalité absente → message `DENIALS.PLAN` existant.
- [ ] Soldes : tableau filtrable (classe, statut), lien vers le détail élève ; détail : tranches (payé / reste / en retard), historique, dialogue « Encaisser » → lien vers le reçu imprimable.
- [ ] Reçu `impression/[schoolId]/recu/[paymentId]` : même gabarit que les impressions existantes.
- [ ] Tableau de bord : 4 chiffres (attendu, encaissé, reste, en retard) + tableau par classe + bloc « En ligne : encaissé / disponible ».
- [ ] Décaissements : disponible, formulaire (montant, numéro Mobile Money ou RIB), historique avec statut.
- [ ] Parent : sur la fiche enfant, tranches et solde, bouton « Payer » (montant prérempli = reste de la tranche en cours) ; en dev, bouton « Simuler le paiement » comme pour l'abonnement (`simulatePayment`, webhook `/webhooks/fee-payments`).
- [ ] Admin : onglet « Décaissements » (demandes, Marquer payé avec référence, Rejeter avec motif).
- [ ] `seed-demo.ts` : grille Les Palmiers (6e-3e : filles 25 000 / garçons 40 000 en 2 tranches ; 2nde-Tle : 70 000 en 3 tranches), quelques encaissements.
- [ ] Vérifier : `pnpm --filter web build`, `npx tsc --noEmit`, `eslint` ; parcours manuel en local (grille → encaissement → reçu → paiement parent simulé → décaissement → validation admin).
- [ ] Commit `Frais de scolarité : écrans école, parent et admin`.

---

## Hors périmètre v1 (à ajouter quand le besoin est réel)

- Réductions et bourses, autres types de frais (inscription, tenue, cantine).
- Branchement de SasPay (docs.saspay.me : checkout hébergé, webhooks, « Payer un bénéficiaire » depuis le solde SasPay) : `checkoutUrl` dans `checkout`, vérification de leur signature de webhook, et appel « Payer un bénéficiaire » au lieu du « Marquer payé » manuel. À faire une fois vérifiés : T-Money (Yas) au Togo, établissement qui détient les fonds, et montage validé juridiquement.
- Commission Soukoulou sur les paiements en ligne.
- Relances par SMS (fonctionnalité `sms`, Premium) : pas de fournisseur SMS encore.
- Changement de niveau en cours d'année : le dû reste celui de l'inscription.
