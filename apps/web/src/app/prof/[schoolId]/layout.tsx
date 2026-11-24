import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { getMe, getNotifications, getTeacherHome } from "@/lib/data";
import { storedNotices } from "@/lib/notices";
import { markNotificationsRead } from "../../notification-actions";
import { logoUrl, todayLabel } from "@/lib/format";
import { logout } from "../../(auth)/actions";

/** Espace enseignant : ses cours, l'appel et les notes de ses classes, rien d'autre. */
export default async function TeacherLayout({ children, params }: LayoutProps<"/prof/[schoolId]">) {
  const { schoolId } = await params;
  const [me, notifications, home] = await Promise.all([
    getMe(),
    getNotifications(schoolId).catch(() => ({ items: [], unread: 0 })),
    getTeacherHome(schoolId).catch((e: unknown) => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) notFound();
      throw e;
    }),
  ]);
  if (me.mustChangePassword) redirect("/mot-de-passe/choisir");
  const base = `/prof/${schoolId}`;

  return (
    <AppShell
      title={home.school.name}
      logo={logoUrl(schoolId, home.school.logo)}
      subtitle="Espace enseignant"
      groups={[
        {
          items: [
            { href: base, label: "Accueil", icon: "home", exact: true },
            { href: `${base}/appel`, label: "Appel", icon: "attendance" },
            { href: `${base}/notes`, label: "Notes", icon: "grades" },
          ],
        },
      ]}
      user={{ name: `${me.firstName} ${me.lastName}`, email: me.email ?? me.loginPhone }}
      logoutAction={logout}
      tools={{ today: todayLabel(), notices: storedNotices(notifications.items, `/prof/${schoolId}`),
        markRead: markNotificationsRead.bind(null, schoolId),
      }}
    >
      {children}
    </AppShell>
  );
}
