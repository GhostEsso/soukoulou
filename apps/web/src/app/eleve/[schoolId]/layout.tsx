import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { getMe, getNotifications, getStudentHome } from "@/lib/data";
import { storedNotices } from "@/lib/notices";
import { markNotificationsRead } from "../../notification-actions";
import { logoUrl, todayLabel } from "@/lib/format";
import { logout } from "../../(auth)/actions";

/** Espace élève : son propre suivi, en lecture seule. */
export default async function StudentLayout({ children, params }: LayoutProps<"/eleve/[schoolId]">) {
  const { schoolId } = await params;
  const [me, notifications, home] = await Promise.all([
    getMe(),
    getNotifications(schoolId).catch(() => ({ items: [], unread: 0 })),
    getStudentHome(schoolId).catch((e: unknown) => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) notFound();
      throw e;
    }),
  ]);
  if (me.mustChangePassword) redirect("/mot-de-passe/choisir");

  return (
    <AppShell
      title={home.school.name}
      logo={logoUrl(schoolId, home.school.logo)}
      subtitle="Espace élève"
      groups={[
        {
          items: [
            { href: `/eleve/${schoolId}`, label: "Mon suivi", icon: "home", exact: true },
            { href: `/eleve/${schoolId}/examens`, label: "Mes examens", icon: "grades" },
          ],
        },
      ]}
      user={{ name: `${me.firstName} ${me.lastName}`, email: home.child.matricule }}
      logoutAction={logout}
      tools={{ today: todayLabel(), notices: storedNotices(notifications.items, `/eleve/${schoolId}`),
        markRead: markNotificationsRead.bind(null, schoolId),
      }}
    >
      {children}
    </AppShell>
  );
}
