"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Phone,
  ClipboardCheck,
} from "lucide-react";
import {
  parentPack,
  type Worry,
  type Strictness,
} from "@backend/services/parents";
import type { PickResult } from "@backend/services/planner";
import type { Room } from "@backend/types/index";
import { track } from "@frontend/lib/client";
import { Copy, ShareCard } from "../trip/Share";
import { formatDates } from "@backend/utils/dates";
export default function Parents({
  room,
  pick,
  optionId,
}: {
  room: Room;
  pick: PickResult;
  optionId: string;
}) {
  const lang = "english" as const;
  const [strictness, S] = useState<Strictness>("moderate"),
    [worry, W] = useState<Worry>("solo_safety"),
    [generated, G] = useState(false);
  const option =
      pick.transport.options.find((o) => o.id === optionId) ??
      pick.transport.options[0],
    pack = parentPack({ room, pick, option, lang, strictness, worry }),
    url =
      "/api/og/parent/" +
      room.id +
      "?" +
      new URLSearchParams({
        dest: pick.destination.id,
        option: option.id,
        lang,
        strictness,
        worry,
      });
  const labels = {
    stay: "Stay plan",
    checkIns: "Check-ins",
    location: "Live location",
    arrival: "Arrival & last mile",
    transport: "Departure",
    returnPlan: "Return plan",
    conditions: "Weather & crowd",
    emergency: "Emergency contacts",
  };
  return (
    <main className="wrap inner stack">
      <Link href={"/trip/" + room.id} className="linkbtn">
        <ArrowLeft size={15} />
        Back to trip
      </Link>
      <div className="room-head">
        <div className="eyebrow">
          <span />
          CONVINCE
        </div>
        <h1>Parent Pack.</h1>
        <p className="muted">
          {pick.destination.name} · {formatDates(room.startDate, room.endDate)}{" "}
          · {option.modeLabel}
        </p>
      </div>
      <section className="panel form-stack">
        <h2>Plan the conversation.</h2>
        <label>
          How strict are your parents?
          <select
            value={strictness}
            onChange={(e) => S(e.target.value as Strictness)}
          >
            <option value="chill">Chill</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          Their main worry
          <select value={worry} onChange={(e) => W(e.target.value as Worry)}>
            <option value="solo_safety">Personal safety</option>
            <option value="budget">Budget</option>
            <option value="company">Who’s coming</option>
            <option value="weather_crowd">Weather & crowd</option>
          </select>
        </label>
        {!generated && (
          <button
            className="primary"
            onClick={() => {
              G(true);
              track("parent_pack_generated", room.id, {
                destination: pick.destination.id,
              });
            }}
          >
            Generate Parent Pack <ArrowRight size={18} />
          </button>
        )}
      </section>
      {generated && (
        <>
          <div className="brief">
            <small>Parent Resistance Score</small>
            <h3>{pack.resistance.label}</h3>
          </div>
          {[
            [MessageCircle, "WhatsApp message", pack.message],
            [Phone, "30-second call pitch", pack.pitch],
          ].map(([I, title, value]) => {
            const Icon = I as typeof Phone;
            return (
              <section key={String(title)} className="panel stack">
                <Icon className="lime" />
                <h2>{String(title)}</h2>
                <p className="prewrap">{String(value)}</p>
                <Copy value={String(value)} />
              </section>
            );
          })}
          <section className="panel stack">
            <ClipboardCheck className="lime" />
            <h2>Safety checklist</h2>
            {pack.checklist.map((item) => (
              <label className="check-item" key={item}>
                <input type="checkbox" />
                {item}
              </label>
            ))}
          </section>
          <section className="brief stack">
            <div className="eyebrow">
              <span />
              PARENT BRIEF
            </div>
            <h2>{pick.destination.name}</h2>
            <p>{formatDates(room.startDate, room.endDate)}</p>
            {Object.entries(pack.brief).map(([k, v]) => (
              <div key={k}>
                <strong>{labels[k as keyof typeof labels]}</strong>
                <p>{v}</p>
              </div>
            ))}
            <ShareCard key={url} kind="parent" id={room.id} url={url} />
          </section>
        </>
      )}
    </main>
  );
}
