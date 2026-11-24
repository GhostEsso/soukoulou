import type { Metadata } from "next";
import { AnnouncementFeed } from "@/components/announcement-feed";
import { getFeed } from "@/lib/data";

export const metadata: Metadata = { title: "Annonces" };

export default async function ParentAnnouncementsPage({ params }: PageProps<"/parent/[schoolId]/annonces">) {
  const { schoolId } = await params;
  const feed = await getFeed(schoolId);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Annonces</h1>
      <AnnouncementFeed items={feed} />
    </div>
  );
}
