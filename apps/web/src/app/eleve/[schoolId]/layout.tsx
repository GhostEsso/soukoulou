import { notFound, redirect } from "next/navigation";
import { feedNotices } from "@/components/announcement-feed";
import { AppShell } from "@/components/app-shell";
import { ApiError } from "@/lib/api";
import { getFeed, getMe, getStudentHome } from "@/lib/data";
import { logoUrl, todayLabel } from "@/lib/format";
import { logout } from "../../(auth)/actions";

/** Espace élève : son propre suivi, en lecture seule. */
export default async function StudentLayout({ children, params }: LayoutProps<"/eleve/[schoolId]">) {
  const { schoolId } = await params;
  const [me, feed, home] = await Promise.all([
    getMe(),
    getFeed(schoolId).catch(() => []),
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
      tools={{ today: todayLabel(), notices: feedNotices(feed, `/eleve/${schoolId}`) }}
    >
      {children}
    </AppShell>
  );
}
