import type { Metadata } from "next";
import { AnnouncementDetailScreen } from "@/components/sidequest/screens/announcement-detail";

export const metadata: Metadata = { title: "Announcement" };

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AnnouncementDetailScreen id={id} />;
}
