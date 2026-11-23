import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { date } from "@/lib/format";
import type { AssessmentDetail } from "@/lib/types";
import { ListCard, readOnlyOf } from "../../list";
import { GradeSheet } from "./grade-sheet";

export const metadata: Metadata = { title: "Saisie des notes" };

export default async function AssessmentPage({ params }: PageProps<"/ecole/[schoolId]/notes/[assessmentId]">) {
  const { schoolId, assessmentId } = await params;
  const [a, readOnly] = await Promise.all([
    api<AssessmentDetail>(`/schools/${encodeURIComponent(schoolId)}/assessments/${encodeURIComponent(assessmentId)}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) notFound();
      throw e;
    }),
    readOnlyOf(schoolId),
  ]);

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/ecole/${schoolId}/notes?classe=${a.classroom.id}`}>
          <ArrowLeft aria-hidden /> Notes · {a.classroom.name}
        </Link>
      </Button>
      <ListCard title={`${a.title} · ${a.subject.name}`} count={a.students.length}>
        <p className="border-t px-4 py-3 text-sm text-muted-foreground sm:px-5">
          {a.classroom.name} · {date(a.day)} · {a.period.name} · noté sur {a.maxScore}
          {a.teacher && ` · ${a.teacher.name}`}
        </p>
        {a.students.length === 0 ? (
          <p className="border-t px-5 py-12 text-center text-sm text-muted-foreground">Aucun élève inscrit dans {a.classroom.name}.</p>
        ) : (
          <GradeSheet schoolId={schoolId} assessment={a} readOnly={readOnly} />
        )}
      </ListCard>
    </div>
  );
}
