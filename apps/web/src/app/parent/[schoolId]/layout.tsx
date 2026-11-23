import { notFound, redirect } from "next/navigation";
import { feedNotices } from "@/components/announcement-feed";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { getFeed, getMe, getParentHome } from "@/lib/data";
import { todayLabel } from "@/lib/format";
import { logout } from "../../(auth)/actions";

/** Espace parent : le suivi de ses enfants, en lecture seule. */
export default async function ParentLayout({ children, params }: LayoutProps<"/parent/[schoolId]">) {
  const { schoolId } = await params;
  const [me, feed, home] = await Promise.all([
    getMe(),
    getFeed(schoolId).catch(() => []),
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
      subtitle="Espace parent"
      groups={[
        { items: [{ href: base, label: "Accueil", icon: "home", exact: true }] },
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
      tools={{ today: todayLabel(), notices: feedNotices(feed, `/parent/${schoolId}`) }}
    >
      {children}
    </AppShell>
  );
}
