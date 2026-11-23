import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";

const SPACES: Record<string, string[]> = {
  SCHOOL_ADMIN: ["ecole", "impression", "fichiers"],
  TEACHER: ["prof"],
  PARENT: ["parent"],
  STUDENT: ["eleve"],
};

/**
 * Oriente l'utilisateur connecté vers son espace. `suite` (page demandée avant la connexion)
 * n'est suivie que si elle appartient à un espace de ce compte : un élève qui se connecte
 * après la session d'un admin ne doit pas atterrir sur une page d'administration.
 */
export default async function SpacePage({ searchParams }: PageProps<"/espace">) {
  const { suite } = await searchParams;
  const me = await api<Me>("/auth/me");
  if (me.mustChangePassword) redirect("/mot-de-passe/choisir");

  const allowed = [
    ...(me.isPlatformAdmin ? ["/admin"] : []),
    ...me.memberships.flatMap((m) => (SPACES[m.role] ?? []).map((p) => `/${p}/${m.school.id}`)),
  ];
  if (typeof suite === "string" && allowed.some((a) => suite === a || suite.startsWith(`${a}/`) || suite.startsWith(`${a}?`))) {
    redirect(suite);
  }
  if (me.isPlatformAdmin) redirect("/admin");
  const school = me.memberships.find((m) => m.role === "SCHOOL_ADMIN")?.school;
  if (school) redirect(`/ecole/${school.id}`);
  const teaching = me.memberships.find((m) => m.role === "TEACHER")?.school;
  if (teaching) redirect(`/prof/${teaching.id}`);
  const family = me.memberships.find((m) => m.role === "PARENT")?.school;
  if (family) redirect(`/parent/${family.id}`);
  const pupil = me.memberships.find((m) => m.role === "STUDENT")?.school;
  if (pupil) redirect(`/eleve/${pupil.id}`);

  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-content-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Aucun espace pour ce compte</h1>
      <p className="text-sm text-muted-foreground">
        Votre compte n’est rattaché à aucune école pour l’instant.
      </p>
      <form action={logout}>
        <Button variant="outline">Se déconnecter</Button>
      </form>
    </main>
  );
}
