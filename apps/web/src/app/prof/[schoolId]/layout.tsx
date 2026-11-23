import { notFound, redirect } from "next/navigation";
import { feedNotices } from "@/components/announcement-feed";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { getFeed, getMe, getTeacherHome } from "@/lib/data";
import { todayLabel } from "@/lib/format";
import { logout } from "../../(auth)/actions";

/** Espace enseignant : ses cours, l'appel et les notes de ses classes, rien d'autre. */
export default async function TeacherLayout({ children, params }: LayoutProps<"/prof/[schoolId]">) {
  const { schoolId } = await params;
  const [me, feed, home] = await Promise.all([
    getMe(),
    getFeed(schoolId).catch(() => []),
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
      tools={{ today: todayLabel(), notices: feedNotices(feed, `/prof/${schoolId}`) }}
    >
      {children}
    </AppShell>
  );
}
