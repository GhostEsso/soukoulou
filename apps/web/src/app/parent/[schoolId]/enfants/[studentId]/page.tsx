import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { one } from "@/app/ecole/[schoolId]/(scolarite)/list";
import { api, ApiError } from "@/lib/api";
import type { ChildFollowUp } from "@/lib/types";
import { FollowUp } from "../../follow-up";

export const metadata: Metadata = { title: "Suivi" };

export default async function ChildPage({ params, searchParams }: PageProps<"/parent/[schoolId]/enfants/[studentId]">) {
  const { schoolId, studentId } = await params;
  const sp = await searchParams;
  const data = await api<ChildFollowUp>(
    `/schools/${encodeURIComponent(schoolId)}/parent/children/${encodeURIComponent(studentId)}`,
  ).catch((e) => {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) notFound();
    throw e;
  });
  return <FollowUp schoolId={schoolId} data={data} here={`/parent/${schoolId}/enfants/${studentId}`} periodId={one(sp.periode)} payment={{ studentId, dev: process.env.NODE_ENV !== "production" }} />;
}
