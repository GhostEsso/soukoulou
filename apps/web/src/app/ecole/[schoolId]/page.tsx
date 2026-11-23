import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  Lock,
  Mail,
  Unlock,
  Users,
} from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { getAttendanceWeek, getMe, getOnboarding, getStructure, getStudentStats, getTeacherCount } from "@/lib/data";
import { schoolNotices } from "@/lib/notices";
import { Dashboard } from "./dashboard";
import { date, daysUntil, VERIFICATION } from "@/lib/format";
import { upgradeProgress } from "@/lib/progress";
import { cn } from "@/lib/utils";
import type { Announcement, Onboarding } from "@/lib/types";

export default async function SchoolHome({ params, searchParams }: PageProps<"/ecole/[schoolId]">) {
  const { schoolId } = await params;
  const { mois } = await searchParams;
  const [me, onboarding] = await Promise.all([getMe(), getOnboarding(schoolId)]);
  const { school } = onboarding;
  const discovery = school.subscriptionStatus === "DISCOVERY";
  const [structure, students, attendance, teachers, announcements] = discovery
    ? [null, null, null, 0, []]
    : await Promise.all([
        getStructure(schoolId),
        getStudentStats(schoolId),
        getAttendanceWeek(schoolId),
        getTeacherCount(schoolId),
        api<Announcement[]>(`/schools/${encodeURIComponent(schoolId)}/announcements`),
      ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {me.firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {discovery
            ? "Découvrez Soukoulou, puis passez à l’abonnement pour gérer votre école."
            : "Voici où en est votre école."}
        </p>
      </div>
      {!structure || !students || !attendance ? (
        <Discovery onboarding={onboarding} />
      ) : (
        <>
          {school.verificationStatus !== "VERIFIED" && <Verification onboarding={onboarding} />}
          <Dashboard
            onboarding={onboarding}
            teachers={teachers}
            structure={structure}
            students={students}
            attendance={attendance}
            notices={schoolNotices(onboarding)}
            announcements={announcements}
            month={typeof mois === "string" ? mois : undefined}
          />
        </>
      )}
    </div>
  );
}

function Discovery({ onboarding }: { onboarding: Onboarding }) {
  const { school } = onboarding;
  const base = `/ecole/${school.id}`;
  const left = school.discoveryExpiresAt ? daysUntil(school.discoveryExpiresAt) : 15;
  const p = upgradeProgress(onboarding);
  const steps = [
    { done: p.info, title: "Informations de l’établissement", text: "Statut, adresse, autorisation, adresse web." },
    { done: p.documents, title: "Pièces justificatives", text: `${p.sent} sur ${p.total} envoyée(s).` },
    { done: p.paid, title: "Offre et paiement", text: "Mobile Money, carte ou virement." },
  ];
  const next = steps.findIndex((s) => !s.done);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden">
        <div className="relative bg-primary px-6 py-7 text-primary-foreground">
          <div aria-hidden className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10" />
          <div className="relative space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium">
              <Clock className="size-3.5" aria-hidden /> Mode découverte
            </span>
            <h2 className="text-xl font-semibold tracking-tight">
              {left > 1 ? `Il vous reste ${left} jours` : left === 1 ? "Dernier jour" : "Votre découverte se termine"}
            </h2>
            <p className="max-w-lg text-sm text-white/85">
              Sans abonnement à la fin de la découverte, le compte est supprimé. Passez à l’abonnement pour gérer
              vos vraies classes, vos élèves et vos notes.
            </p>
            <Progress
              value={((15 - left) / 15) * 100}
              className="h-1.5 max-w-sm bg-white/20 [&>div]:bg-white"
              aria-label="Jours de découverte écoulés"
            />
          </div>
        </div>
        <CardContent className="space-y-1 pt-6">
          <p className="mb-3 text-sm font-semibold">Passer à l’abonnement en 3 étapes</p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3",
                  i === next && "border-primary/30 bg-accent/60",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                    s.done ? "bg-success text-white" : i === next ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {s.done ? <Check className="size-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {s.title}
                    <span className="sr-only">{s.done ? " (fait)" : " (à faire)"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="pt-4">
            <Button asChild size="lg">
              <Link href={`${base}/upgrade`}>
                {next <= 0 ? "Commencer l’upgrade" : "Continuer l’upgrade"} <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-lg bg-accent text-primary">
              <Building2 className="size-5" aria-hidden />
            </div>
            <CardTitle>Explorer l’école de démo</CardTitle>
            <CardDescription>
              Classes, notes, bulletins, discipline : voyez Soukoulou avec une école fictive, sans rien saisir.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href={`${base}/decouverte`}>Ouvrir la démo</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pourquoi des pièces justificatives ?</CardTitle>
            <CardDescription>
              Elles garantissent aux parents qu’ils parlent à une vraie école. Vous configurez votre école dès le
              paiement ; les invitations s’ouvrent après la vérification, sous 48 h ouvrées.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function Verification({ onboarding }: { onboarding: Onboarding }) {
  const { school, access } = onboarding;
  const base = `/ecole/${school.id}`;
  const v = VERIFICATION[school.verificationStatus];
  const verified = school.verificationStatus === "VERIFIED";

  const can = [
    { label: "Configurer l’école", hint: "Classes, matières, règles de calcul", ok: access.write === null, icon: Building2 },
    { label: "Inviter enseignants, élèves, parents", hint: "Après validation des pièces", ok: access.invite === null, icon: Users },
    { label: "Publier et envoyer des messages", hint: "Après validation des pièces", ok: access.publish === null, icon: Mail },
  ];

  return (
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Vérification de l’école</CardTitle>
            <CardDescription>
              {school.verificationStatus === "PENDING" &&
                "Merci pour votre paiement. Nos équipes vérifient vos pièces, sous 48 h ouvrées. Vous pouvez déjà configurer votre école."}
              {school.verificationStatus === "CHANGES_REQUESTED" &&
                "Une ou plusieurs pièces sont à corriger. Remplacez-les puis renvoyez le dossier."}
              {verified && `Votre école est vérifiée depuis le ${date(school.verifiedAt)}. Tout est ouvert.`}
              {school.verificationStatus === "REJECTED" && "Le dossier a été refusé. Contactez Soukoulou."}
            </CardDescription>
          </div>
          <StatusBadge tone={v.tone}>{v.label}</StatusBadge>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-3">
            {can.map((c) => (
              <li key={c.label} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <c.icon className="size-4 text-muted-foreground" aria-hidden />
                  {c.ok ? (
                    <Unlock className="size-4 text-success" aria-label="Ouvert" />
                  ) : (
                    <Lock className="size-4 text-muted-foreground" aria-label="Verrouillé" />
                  )}
                </div>
                <p className="text-sm font-medium">{c.label}</p>
                {!c.ok && <p className="text-xs text-muted-foreground">{c.hint}</p>}
              </li>
            ))}
          </ul>
          {school.verificationStatus === "CHANGES_REQUESTED" && (
            <Button asChild>
              <Link href={`${base}/pieces`}>
                Corriger mes pièces <ArrowRight aria-hidden />
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
  );
}
