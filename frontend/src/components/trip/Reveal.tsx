"use client";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowUpRight,
  Bus,
  Train,
  Car,
  Plane,
  CloudSun,
  MapPin,
  Users,
  ArrowRight,
} from "lucide-react";
import type { Room } from "@backend/types/index";
import { money } from "@backend/types/index";
import type { PickResult, Recommendation } from "@backend/services/planner";
import { costSplit } from "@backend/services/transport";
import { json, track } from "@frontend/lib/client";
import { ShareCard } from "./Share";
export const verdictLabel = (v: string | null) =>
  v ? v.replaceAll("_", " ") : "Seasonal outlook";
const formatRange = (r: [number, number]) => money(r[0]) + "–" + money(r[1]);
export default function Reveal({ room }: { room: Room }) {
  const version = room.participants
    .map((p) => p.id + ":" + p.comfortBudget + ":" + p.vibes.join())
    .join("|");
  const { data, error, mutate } = useSWR<Recommendation>(
    ["reveal", room.id, version],
    () => json("/api/rooms/" + room.id + "/reveal"),
    { keepPreviousData: true },
  );
  const seen = useRef(""),
    checked = useRef("");
  useEffect(() => {
    if (!data) return;
    if (seen.current !== room.id) {
      track("reveal_viewed", room.id);
      seen.current = room.id;
    }
    if (checked.current !== version) {
      track(
        "trip_check_run",
        room.id,
        data.picks[0] ? { destination: data.picks[0].destination.id } : {},
      );
      checked.current = version;
    }
  }, [room.id, data, version]);
  if (error)
    return (
      <section className="panel">
        <p role="alert">{error.message}</p>
        <button className="secondary" onClick={() => mutate()}>
          Retry weekend check
        </button>
      </section>
    );
  if (!data)
    return (
      <div className="skeleton" aria-label="Checking routes and weather" />
    );
  return (
    <section className="stack">
      <div className="eyebrow">
        <span /> THE SHORTLIST
      </div>
      <h2>Your weekend picks.</h2>
      {data.reason && <div className="subpanel">{data.reason}</div>}
      {data.swap && (
        <p className="brief">
          <strong>Smart Swap</strong> · {data.swap}
        </p>
      )}
      {data.picks.map((p) => (
        <DestinationCard key={p.destination.id} pick={p} room={room} />
      ))}
    </section>
  );
}
function DestinationCard({ pick: p, room }: { pick: PickResult; room: Room }) {
  const d = p.destination,
    options = p.transport.options,
    [selected, setSelected] = useState(options[0].id),
    [more, setMore] = useState(false);
  const o = options.find((x) => x.id === selected) ?? options[0],
    g = o.gateway,
    c = costSplit(d, room, options, o.id);
  const query = new URLSearchParams({ dest: d.id, option: o.id }).toString();
  const booking =
    o.mode === "train"
      ? ["IRCTC", "https://www.irctc.co.in/"]
      : o.mode === "flight"
        ? ["Flight search", "https://www.google.com/travel/flights"]
        : o.mode.startsWith("bus")
          ? ["redBus", "https://www.redbus.in/"]
          : null;
  return (
    <article className="dest-card stack">
      <div className="section-top">
        <div>
          <span className="tiny lime">{d.state.toUpperCase()}</span>
          <h2>{d.name}</h2>
        </div>
        <span className="chip">{p.match}% match</span>
      </div>
      <div className="two-cols">
        <div className="subpanel stack">
          <div className="row">
            <CloudSun className="lime" />
            <small>WEATHER</small>
          </div>
          <h3>{verdictLabel(p.weather.verdict)}</h3>
          <p>{p.weather.reasons.join(" ")}</p>
          {p.weather.available && (
            <small>
              {p.weather.minC}–{p.weather.maxC}°C · up to{" "}
              {p.weather.rainProbability}% rain
            </small>
          )}
        </div>
        <div className="subpanel stack">
          <div className="row">
            <Users className="lime" />
            <small>CROWD ESTIMATE</small>
          </div>
          <h3>{p.crowd.label}</h3>
          <label>Estimated crowd level · {p.crowd.level}/5</label>
          <div className="meter">
            <span style={{ width: p.crowd.level * 20 + "%" }} />
          </div>
          <p>{p.crowd.tip}</p>
          <details>
            <summary>Why this estimate?</summary>
            <p>{p.crowd.reasons.join(" ")}</p>
          </details>
        </div>
      </div>
      <h3>How to get there</h3>
      <p>{p.transport.reason}</p>
      <div className="routes">
        {(more ? options : options.slice(0, 4)).map((x) => {
          const Icon =
            x.mode === "flight"
              ? Plane
              : x.mode === "train"
                ? Train
                : x.mode === "cab_self_drive"
                  ? Car
                  : Bus;
          return (
            <button
              className="route-option"
              key={x.id}
              aria-pressed={x.id === o.id}
              onClick={() => {
                setSelected(x.id);
                track("transport_option_selected", room.id, {
                  mode: x.mode,
                  destination: d.id,
                });
              }}
            >
              <div className="row">
                <strong className="inline">
                  <Icon size={16} />
                  {x.modeLabel}
                </strong>
                <strong>{formatRange(x.costRange)}</strong>
              </div>
              <small>
                {Math.floor(x.doorToDoorMinutes / 60)}h{" "}
                {x.doorToDoorMinutes % 60}m door to door · return fare incl.
                last mile
              </small>
              <div className="chips">
                {x.badges.map((b) => (
                  <span key={b} className="chip">
                    {b}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      {options.length > 4 && (
        <button className="secondary" onClick={() => setMore(!more)}>
          {more ? "Show fewer options" : "See all routes"}
        </button>
      )}
      <div className="subpanel stack" aria-live="polite">
        <h3>Where you'll arrive</h3>
        <strong>
          <MapPin size={16} className="inline" /> {g.name}{" "}
          {g.code && "(" + g.code + ")"}
        </strong>
        <p>
          {g.type} · about {g.distanceKmToDest} km from the stay area. Depart{" "}
          {o.typicalDepartureWindow}, arrive {o.typicalArrivalWindow} IST.
        </p>
        <p>
          Last mile ·{" "}
          {g.lastMile.options.map((s) => s.replaceAll("_", " ")).join(" / ")} ·{" "}
          {g.lastMile.minutes} min · {formatRange(g.lastMile.costINR)} one way.{" "}
          {g.lastMile.note}
        </p>
        <small>
          Nearest railhead · {d.nearestRailhead}
          <br />
          Nearest airport · {d.nearestAirport}
        </small>
        {o.warnings.map((w) => (
          <p key={w}>△ {w}</p>
        ))}
        <p>
          <b>Return plan</b> · {p.transport.returnPlan}
        </p>
        <p>{o.bookingHint}</p>
        <div className="panel-actions">
          <a
            className="linkbtn"
            target="_blank"
            rel="noopener noreferrer"
            href={
              "https://www.google.com/maps/search/?api=1&query=" +
              encodeURIComponent(g.name)
            }
            onClick={() =>
              track("maps_link_clicked", room.id, {
                mode: o.mode,
                destination: d.id,
              })
            }
          >
            Open in Google Maps <ArrowUpRight size={14} />
          </a>
          {booking && (
            <a
              className="linkbtn"
              href={booking[1]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("booking_link_clicked", room.id, {
                  mode: o.mode,
                  destination: d.id,
                })
              }
            >
              {booking[0]} <ArrowUpRight size={14} />
            </a>
          )}
        </div>
        <small>Estimated, check live timings and fares before booking.</small>
      </div>
      <details className="divided">
        <summary>48-hour plan & local tips</summary>
        <dl className="stack">
          {Object.entries(d.itineraryTemplate).map(([k, v]) => (
            <div key={k}>
              <dt className="lime">
                {
                  {
                    fridayNight: "Friday night",
                    saturday: "Saturday",
                    sunday: "Sunday",
                  }[k]
                }
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <ul>
          {d.localTips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
      <details open className="divided">
        <summary>Estimated cost split · {money(c.total)} per person</summary>
        <div className="stack">
          {[
            ["Return transport + last mile", c.transport],
            ["Stay · " + c.nights + " nights", c.stay],
            ["Food · " + c.days + " days", c.food],
            ["Local travel", c.local],
          ].map(([k, v]) => (
            <div key={k} className="row">
              <span>{k}</span>
              <span>{money(Number(v))}</span>
            </div>
          ))}
          <strong className="lime">
            Estimated range · {formatRange(c.range)}
          </strong>
          {d.hasGoSTOPS ? (
            <a
              href={"https://www.gostops.com/?utm_source=chalein"}
              onClick={() =>
                track("gostops_clicked", room.id, { destination: d.id })
              }
            >
              Hostel stay ~
              {money((d.costPerDay.stay[0] + d.costPerDay.stay[1]) / 2)}/night
              (estimate). Check goSTOPS {d.name} ↗
            </a>
          ) : (
            <p>Look for hostels with 24x7 reception and good reviews.</p>
          )}
        </div>
      </details>
      <div className="panel-actions">
        <Link
          className="primary inline"
          href={"/trip/" + room.id + "/parents?" + query}
        >
          Build Parent Pack <ArrowRight size={16} />
        </Link>
        <ShareCard
          key={query}
          kind="trip"
          id={room.id}
          url={"/api/og/trip/" + room.id + "?" + query}
        />
      </div>
    </article>
  );
}
