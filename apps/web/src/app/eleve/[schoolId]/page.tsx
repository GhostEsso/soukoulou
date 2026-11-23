import type { Metadata } from "next";
import { one } from "@/app/ecole/[schoolId]/(scolarite)/list";
import { FollowUp } from "@/app/parent/[schoolId]/follow-up";
import { AnnouncementFeed } from "@/components/announcement-feed";
import { getFeed, getStudentHome } from "@/lib/data";

export const metadata: Metadata = { title: "Mon suivi" };

export default async function StudentHomePage({ params, searchParams }: PageProps<"/eleve/[schoolId]">) {
  const { schoolId } = await params;
  const sp = await searchParams;
  const [data, feed] = await Promise.all([getStudentHome(schoolId), getFeed(schoolId)]);
  return (
    <FollowUp
      schoolId={schoolId}
      data={data}
      here={`/eleve/${schoolId}`}
      periodId={one(sp.periode)}
      aside={<AnnouncementFeed items={feed} />}
    />
  );
}
