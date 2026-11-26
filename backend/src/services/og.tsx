import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import { parseId, type Context, failure } from "../http/api";
import { cardQuery } from "../schemas/trip";
import { chosen, requireRoom } from "./reveal";
import { ApiError } from "../db/store";
import { parentPack } from "./parents";
import { formatDates } from "../utils/dates";
import { costSplit } from "./transport";
import { money } from "../types/index";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
async function loadFonts() {
  const publicRoot = existsSync(path.join(process.cwd(), "public", "card-fonts"))
    ? path.join(process.cwd(), "public")
    : path.join(process.cwd(), "frontend", "public");
  const dir = path.join(publicRoot, "card-fonts");
  const [body, extra, title] = await Promise.all(
    ["body.woff", "currency.woff", "display.woff"].map((s) =>
      readFile(path.join(dir, s)),
    ),
  );
  return [
    { name: "Body", data: body, weight: 400 as const },
    { name: "Currency", data: extra, weight: 400 as const },
    { name: "Display", data: title, weight: 800 as const },
  ];
}
let fonts: ReturnType<typeof loadFonts> | undefined;
const fg = "#f7f8e9",
  lime = "#d2fa70",
  dark = "#192016";
function Frame({ children, kind }: { children: ReactNode; kind: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: dark,
        color: fg,
        padding: "62px 66px",
        fontFamily: "Body,Currency",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "3px solid #536343",
          paddingBottom: 24,
          marginBottom: 30,
        }}
      >
        <b
          style={{
            fontSize: 60,
            color: lime,
            fontFamily: "Display",
            fontWeight: 800,
          }}
        >
          WeekendWise
        </b>
        <span style={{ fontSize: 23, letterSpacing: 3 }}>{kind}</span>
      </div>
      {children}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "auto",
          borderTop: "2px dashed #788960",
          paddingTop: 18,
          color: lime,
          fontSize: 24,
        }}
      >
        <span>WEEKEND FIELD GUIDE</span>
        <span>Estimated trip plan</span>
      </div>
    </div>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginBottom: 17 }}>
      <span style={{ color: lime, fontSize: 21, letterSpacing: 1.5 }}>
        {label.toUpperCase()}
      </span>
      <span style={{ fontSize: 28, lineHeight: 1.22 }}>{value}</span>
    </div>
  );
}
export async function card(req: Request, c: Context, kind: "trip" | "parent") {
  try {
    const id = await parseId(c),
      query = cardQuery
        .extend({ download: z.literal("1").optional() })
        .parse(Object.fromEntries(new URL(req.url).searchParams));
    const r = await requireRoom(id);
    const selected = r.participants.length
      ? await chosen(r, query.dest, query.option)
      : null;
    if (!selected && (query.dest || query.option || kind === "parent"))
      throw new ApiError(409, "This shortlist changed. Reopen your trip.");
    const date = formatDates(r.startDate, r.endDate);
    let content: ReactNode;
    if (!selected) {
      content = (
        <div
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <span style={{ fontSize: 34, color: lime }}>
            {r.startCity} · {date}
          </span>
          <b
            style={{
              fontFamily: "Display",
              fontWeight: 800,
              fontSize: 118,
              lineHeight: 1.02,
              margin: "90px 0",
            }}
          >
            Where will this weekend take you?
          </b>
          <span style={{ fontSize: 43 }}>
            Vote on a vibe. Find a weekend together.
          </span>
          <span style={{ fontSize: 37, marginTop: 42 }}>
            Starting budget · {money(r.maxBudgetPerPerson)} each
          </span>
        </div>
      );
    } else {
      const { pick: p, option: o } = selected;
      const cost = costSplit(p.destination, r, p.transport.options, o.id);
      if (kind === "trip") {
        content = (
          <div
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
          >
            <span style={{ fontSize: 33, color: lime }}>
              {r.participants[0]?.name || "Solo"}
              {r.participants.length > 1
                ? " + " + (r.participants.length - 1) + " others"
                : ""}{" "}
              · {date}
            </span>
            <b
              style={{
                fontFamily: "Display",
                fontWeight: 800,
                fontSize: 90,
                marginTop: 43,
                lineHeight: 1.06,
              }}
            >
              {p.destination.name}
            </b>
            <span style={{ fontSize: 45 }}>{p.destination.state}</span>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                backgroundColor: lime,
                color: dark,
                borderRadius: 22,
                margin: "50px 0 32px",
                padding: "32px 40px",
              }}
            >
              <b
                style={{
                  fontFamily: "Display",
                  fontWeight: 800,
                  fontSize: 100,
                }}
              >
                {p.match}% match
              </b>
              <span style={{ fontSize: 47 }}>
                {money(cost.total)} weekend per person
              </span>
            </div>
            <Line
              label="Getting there"
              value={
                (o.overnight ? "Overnight " : "") +
                o.modeLabel +
                " from " +
                r.startCity
              }
            />
            <Line
              label="Weather"
              value={
                p.weather.verdict?.replaceAll("_", " ") ||
                "Forecast unavailable · seasonal guide"
              }
            />
            <Line label="Estimated crowd level" value={p.crowd.label} />
          </div>
        );
      } else {
        const { brief } = parentPack({
          room: r,
          pick: p,
          option: o,
          lang: query.lang,
          worry: query.worry,
          strictness: query.strictness,
        });
        content = (
          <div
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
          >
            <b
              style={{
                fontFamily: "Display",
                fontWeight: 800,
                fontSize: 62,
                lineHeight: 1.1,
              }}
            >
              {p.destination.name}
            </b>
            <span style={{ fontSize: 30, margin: "5px 0 24px" }}>
              {date} · {r.mode === "solo" ? "Solo" : "With friends"} ·{" "}
              {money(cost.total)} est.
            </span>
            {[
              ["Departure", brief.transport],
              ["Arrival & last mile", brief.arrival],
              ["Return plan", brief.returnPlan],
              ["Stay", brief.stay],
              ["Check-ins", brief.checkIns],
              ["Live location", brief.location],
              ["Conditions", brief.conditions],
              ["Emergency contacts", brief.emergency],
            ].map(([label, value]) => (
              <Line key={label} label={label} value={value} />
            ))}
          </div>
        );
      }
    }
    return new ImageResponse(
      <Frame kind={kind === "parent" ? "PARENT BRIEF" : "WEEKEND PASS"}>
        {content}
      </Frame>,
      {
        width: 1080,
        height: 1350,
        fonts: await (fonts ??= loadFonts()),
        headers: {
          "Cache-Control": query.download
            ? "private, no-store"
            : "public, max-age=60, s-maxage=120",
          ...(query.download
            ? {
                "Content-Disposition":
                  'attachment; filename="weekendwise-' + kind + '.png"',
              }
            : {}),
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
