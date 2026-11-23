import { notFound } from "next/navigation";
import { AppShell, type NavItem } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { ApiError } from "@/lib/api";
import { brandColorOf, getMe, getOnboarding } from "@/lib/data";
import { SUBSCRIPTION, todayLabel } from "@/lib/format";
import { schoolNotices } from "@/lib/notices";
import { logout } from "../../(auth)/actions";
import { StatusBanner } from "./status-banner";

export default async function SchoolLayout({ children, params }: LayoutProps<"/ecole/[schoolId]">) {
  const { schoolId } = await params;
  const [me, onboarding] = await Promise.all([
    getMe(),
    getOnboarding(schoolId).catch((e: unknown) => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) notFound();
      throw e;
    }),
  ]);
  const { school, requirements } = onboarding;
  const base = `/ecole/${school.id}`;
  const discovery = school.subscriptionStatus === "DISCOVERY";
  const docsToFix = requirements.filter(
    (r) => (r.isMandatory && !r.document) || r.document?.reviewStatus === "REJECTED",
  ).length;
  const brand = brandColorOf(onboarding);
  const notices = schoolNotices(onboarding);

  const groups: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        { href: base, label: "Accueil", icon: "home", exact: true },
        ...(discovery
          ? [
              { href: `${base}/decouverte`, label: "École de démo", icon: "demo" as const },
              { href: `${base}/upgrade`, label: "Passer à l’abonnement", icon: "upgrade" as const },
            ]
          : []),
      ],
    },
    ...(!discovery
      ? [
          {
            label: "Scolarité",
            items: [
              { href: `${base}/eleves`, label: "Élèves", icon: "students" as const },
              { href: `${base}/parents`, label: "Parents", icon: "parents" as const },
              { href: `${base}/presences`, label: "Présences", icon: "attendance" as const },
              { href: `${base}/emploi-du-temps`, label: "Emploi du temps", icon: "schedule" as const },
              { href: `${base}/enseignants`, label: "Enseignants", icon: "teachers" as const },
              { href: `${base}/notes`, label: "Notes", icon: "grades" as const },
              { href: `${base}/bulletins`, label: "Bulletins", icon: "reports" as const },
              { href: `${base}/annonces`, label: "Annonces", icon: "announcements" as const },
              { href: `${base}/annees`, label: "Années scolaires", icon: "years" as const },
              { href: `${base}/niveaux`, label: "Niveaux", icon: "levels" as const },
              { href: `${base}/matieres`, label: "Matières", icon: "subjects" as const },
              { href: `${base}/classes`, label: "Classes", icon: "classes" as const },
            ],
          },
        ]
      : []),
    {
      label: "Mon école",
      items: [
        {
          href: `${base}/pieces`,
          label: "Pièces justificatives",
          icon: "documents",
          badge: docsToFix && !discovery ? docsToFix : undefined,
        },
        ...(!discovery
          ? [
              { href: `${base}/abonnement`, label: "Abonnement", icon: "subscription" as const },
              { href: `${base}/apparence`, label: "Apparence", icon: "theme" as const },
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      {brand && (
        // Couleur validée côté API (contraste) et ici (format #RRGGBB).
        <style>{`:root{--brand:${brand}}`}</style>
      )}
      <AppShell
        title={school.name}
        subtitle={school.slug ? `${school.slug}.soukoulou.com` : `${school.city}`}
        groups={groups}
        user={{ name: `${me.firstName} ${me.lastName}`, email: me.email }}
        logoutAction={logout}
        tools={{ today: todayLabel(), notices }}
        headerEnd={
          <StatusBadge tone={SUBSCRIPTION[school.subscriptionStatus].tone} className="hidden sm:inline-flex">
            {SUBSCRIPTION[school.subscriptionStatus].label}
          </StatusBadge>
        }
      >
        <StatusBanner onboarding={onboarding} />
        {children}
      </AppShell>
    </>
  );
}
