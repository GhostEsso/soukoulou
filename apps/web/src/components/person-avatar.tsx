import { cn } from "@/lib/utils";

/** Photo d'un enseignant ou d'un élève, ou ses initiales à défaut. */
export function PersonAvatar({
  kind,
  schoolId,
  person: teacher,
  className,
}: {
  kind: "enseignants" | "eleves";
  schoolId: string;
  person: { id: string; firstName: string; lastName: string; photo: string | null };
  className?: string;
}) {
  const base = cn("grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold", className);
  if (teacher.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- image privée relayée, pas d'optimisation Next.
      <img
        src={`/photos/${kind}/${schoolId}/${teacher.id}?v=${teacher.photo}`}
        alt=""
        className={cn(base, "object-cover")}
      />
    );
  }
  return (
    <span aria-hidden className={base}>
      {teacher.firstName[0]}
      {teacher.lastName[0]}
    </span>
  );
}
