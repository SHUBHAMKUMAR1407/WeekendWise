import Link from "next/link";
import { notFound } from "next/navigation";
import Parents from "@frontend/components/parents/Parents";
import { roomId, cardQuery } from "@backend/schemas/trip";
import { getRoom } from "@backend/db/redis";
import { chosen } from "@backend/services/reveal";
export const dynamic = "force-dynamic";
export default async function ParentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!roomId.safeParse(id).success) notFound();
  const r = await getRoom(id);
  if (!r) notFound();
  const q = cardQuery
    .pick({ dest: true, option: true })
    .safeParse(await searchParams);
  const selected =
    q.success && r.participants.length
      ? await chosen(r, q.data.dest, q.data.option)
      : null;
  if (!selected)
    return (
      <main className="wrap inner">
        <div className="panel stack">
          <h1>Pick a weekend first.</h1>
          <p>
            Your shortlist may have changed. Choose a destination and transport
            from the room.
          </p>
          <Link className="linkbtn" href={"/trip/" + id}>
            Open trip
          </Link>
        </div>
      </main>
    );
  return (
    <Parents room={r} pick={selected.pick} optionId={selected.option.id} />
  );
}
