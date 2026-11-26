"use client";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { ArrowRight, MapPin, Users } from "lucide-react";
import type { Room } from "@backend/types/index";
import { money, PRIVACY, VIBE_NAMES, VIBE_TAGS } from "@backend/types/index";
import { formatDates } from "@backend/utils/dates";
import { identity, json } from "@frontend/lib/client";
import { Budget, Vibes } from "../forms/Fields";
import { ShareLink } from "./Share";
import Reveal from "./Reveal";
import { Expired } from "../layout/Shell";
export default function RoomView({ initial }: { initial: Room }) {
  const url = "/api/rooms/" + initial.id;
  const {
    data: r = initial,
    error: pollError,
    mutate,
  } = useSWR<Room>(url, json, {
    fallbackData: initial,
    refreshInterval: 4000,
    dedupingInterval: 1000,
  });
  const [name, setName] = useState(""),
    [vibes, setVibes] = useState<string[]>([]),
    [budget, setBudget] = useState(initial.maxBudgetPerPerson),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const solo = r.mode === "solo",
    revealed = solo || r.revealed;
  const vibeLabels = new Map<string, string>(VIBE_TAGS.map(tag => [tag, VIBE_NAMES[tag]]));
  for (const person of r.participants) for (const vibe of person.vibes) {
    const key = vibe.toLowerCase();
    if (!vibeLabels.has(key)) vibeLabels.set(key, vibe);
  }
  async function join(e: FormEvent) {
    e.preventDefault();
    if (vibes.length < 1) {
      setError("Choose at least one vibe or add your own.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await mutate(
        await json<Room>(url + "/join", {
          ...identity(),
          name,
          vibes,
          comfortBudget: budget,
        }),
        false,
      );
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reveal() {
    setBusy(true);
    setError("");
    try {
      await mutate(await json<Room>(url + "/reveal", {}), false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (pollError?.message?.includes("expired")) return <Expired />;
  const groupForm = (
    <form onSubmit={join} className="form-stack">
      <label>
        Full name
        <input
          required
          maxLength={80}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Vibes v={vibes} onChange={setVibes} />
      <Budget value={budget} onChange={setBudget} />
      <button className="primary" disabled={busy}>
        {saved ? "Update my vote" : "Save my vote"} <ArrowRight size={18} />
      </button>
    </form>
  );
  return (
    <main className="wrap inner stack">
      <div className="room-head">
        <span className="eyebrow">
          <span />
          {solo ? "SOLO TRIP" : r.mode === "family" ? "FAMILY TRIP" : "GROUP TRIP"}
        </span>
        <h1>{solo ? "Your weekend." : r.mode === "family" ? "Weekend with family." : "Weekend with the gang."}</h1>
        <div className="row">
          <span className="muted">
            {r.startCity} · {formatDates(r.startDate, r.endDate)} ·{" "}
            {money(r.maxBudgetPerPerson)} starting budget
          </span>
          {!solo && <ShareLink id={r.id} />}
        </div>
      </div>
      {pollError && <p role="status">Reconnecting to your trip…</p>}
      {!solo && (
        <>
          <section className="panel stack">
            <div className="section-top">
              <h2>Group Vibe Meter</h2>
              <span className="chip">
                <Users size={13} className="inline" /> {r.participants.length}
                /20
              </span>
            </div>
            {r.participants.length ? (
              <>
                <div className="avatars">
                  {r.participants.map((p) => (
                    <span className="avatar" key={p.id}>
                      {p.name}
                    </span>
                  ))}
                </div>
                <div className="stack">
                  {Array.from(vibeLabels).map(([tag, label]) => {
                    const n = r.participants.filter((p) =>
                      p.vibes.some(vibe => vibe.toLowerCase() === tag),
                    ).length;
                    return (
                      <div key={tag}>
                        <div className="row mini">
                          {label}
                          <span>{n} votes</span>
                        </div>
                        <div className="meter">
                          <span
                            style={{
                              width: (100 * n) / r.participants.length + "%",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p>
                  Group budget{" "}
                  <strong>
                    {money(
                      Math.min(...r.participants.map((p) => p.comfortBudget)),
                    )}
                  </strong>
                  , set by the tightest budget so nobody gets left out.
                </p>
                {!revealed && (
                  <button className="primary" disabled={busy} onClick={reveal}>
                    Reveal our weekend <ArrowRight size={18} />
                  </button>
                )}
              </>
            ) : (
              <p>
                No votes yet. Add the first vote or invite your{" "}
                {r.mode === "family" ? "family" : "friends"}.
              </p>
            )}
          </section>
          <section className="panel">
            {saved || revealed ? (
              <details>
                <summary>
                  {saved
                    ? "Vote saved · Edit my vote"
                    : "Join the trip · Vote on your vibe"}
                </summary>
                {groupForm}
              </details>
            ) : (
              <div className="stack">
                <h2>What's your vibe?</h2>
                {groupForm}
              </div>
            )}
          </section>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {revealed && <Reveal room={r} />}
      <p className="privacy">
        <MapPin size={14} />
        {PRIVACY}
      </p>
    </main>
  );
}
