import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { getMe, getNotifications, getParentHome } from "@/lib/data";
import { storedNotices } from "@/lib/notices";
import { markNotificationsRead } from "../../notification-actions";
import { logoUrl, todayLabel } from "@/lib/format";
import { logout } from "../../(auth)/actions";

/** Espace parent : le suivi de ses enfants, en lecture seule. */
export default async function ParentLayout({ children, params }: LayoutProps<"/parent/[schoolId]">) {
  const { schoolId } = await params;
  const [me, notifications, home] = await Promise.all([
    getMe(),
    getNotifications(schoolId).catch(() => ({ items: [], unread: 0 })),
    getParentHome(schoolId).catch((e: unknown) => {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) notFound();
      throw e;
    }),
  ]);
  if (me.mustChangePassword) redirect("/mot-de-passe/choisir");
  const base = `/parent/${schoolId}`;

  return (
    <AppShell
      title={home.school.name}
      logo={logoUrl(schoolId, home.school.logo)}
      subtitle="Espace parent"
      groups={[
        {
          items: [
            { href: base, label: "Accueil", icon: "home", exact: true },
            { href: `${base}/annonces`, label: "Annonces", icon: "announcements" },
          ],
        },
        {
          label: "Mes enfants",
          items: home.children.map((c) => ({
            href: `${base}/enfants/${c.id}`,
            label: c.firstName,
            icon: "students" as const,
          })),
        },
      ]}
      user={{ name: `${me.firstName} ${me.lastName}`, email: me.email ?? me.loginPhone }}
      logoutAction={logout}
      tools={{ today: todayLabel(), notices: storedNotices(notifications.items, `/parent/${schoolId}`),
        markRead: markNotificationsRead.bind(null, schoolId),
      }}
    >
      {children}
    </AppShell>
  );
}
