import { notFound } from "next/navigation";
import { getRoom } from "@backend/db/redis";
import { roomId } from "@backend/schemas/trip";
import RoomView from "@frontend/components/trip/RoomView";
import type { Context } from "@backend/http/api";
import type { Metadata } from "next";
import { siteUrl } from "@backend/config/site";
import { formatDates } from "@backend/utils/dates";
import { cache } from "react";
const loadRoom = cache(getRoom);
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Context): Promise<Metadata> {
  const { id } = await params;
  if (!roomId.safeParse(id).success) return {};
  const r = await loadRoom(id);
  if (!r) return { title: "Trip expired", robots: { index: false } };
  const title = "Weekend from " + r.startCity + " · WeekendWise",
    description =
      formatDates(r.startDate, r.endDate) +
      " · " +
      (r.mode === "solo"
        ? "See my weekend plan."
        : "Vote on your vibe and find the gang’s weekend.");
  const base = siteUrl(),
    url = base + "/trip/" + id,
    img = base + "/api/og/trip/" + id;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: [
        {
          url: img,
          width: 1080,
          height: 1350,
          type: "image/png",
          alt: "WeekendWise weekend pass from " + r.startCity,
        },
      ],
    },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}
export default async function Trip({ params }: Context) {
  const { id } = await params;
  if (!roomId.safeParse(id).success) notFound();
  const room = await loadRoom(id);
  if (!room) notFound();
  return <RoomView initial={room} />;
}
