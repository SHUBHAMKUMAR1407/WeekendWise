"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowUpRight, LockKeyhole, LogOut, Search, Users } from "lucide-react";
import type { AdminSearchResult } from "@backend/types/admin";
import { formatDates } from "@backend/utils/dates";
import { money, VIBE_NAMES, type Vibe } from "@backend/types/index";
import { CROWD_OPTIONS, EXPERIENCE_OPTIONS, WEATHER_OPTIONS } from "@backend/types/updates";

interface Session { configured: boolean; authenticated: boolean; expiresAt: number | null }
class AdminRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
async function request<T>(url: string, method = "GET", payload?: unknown): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store", credentials: "same-origin",
    ...(payload === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new AdminRequestError(data?.error || "Request failed. Please try again.", response.status);
  return data;
}
const timestamp = (value: string) => new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
}).format(new Date(value)) + " IST";

export default function AdminPanel() {
  const { data: session, error: sessionError, mutate } = useSWR<Session>("/api/admin/session", () => request<Session>("/api/admin/session"), { refreshInterval: 60000 });
  const [key, setKey] = useState(""), [name, setName] = useState(""), [match, setMatch] = useState<"contains" | "exact">("contains");
  const [results, setResults] = useState<AdminSearchResult | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loginBusy, setLoginBusy] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    if (!session?.authenticated) { requestId.current++; setResults(null); setName(""); setBusy(false); }
    if (!session?.expiresAt) return;
    const timer = setTimeout(() => { requestId.current++; setResults(null); void mutate(); }, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [session?.authenticated, session?.expiresAt, mutate]);

  async function login(event: FormEvent) {
    event.preventDefault(); setLoginBusy(true); setError("");
    try {
      const result = await request<{ authenticated: boolean; expiresAt: number }>("/api/admin/session", "POST", { key });
      setKey(""); setResults(null);
      await mutate({ configured: true, authenticated: result.authenticated, expiresAt: result.expiresAt }, false);
    } catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed."); }
    finally { setLoginBusy(false); }
  }
  async function logout() {
    requestId.current++; setResults(null); setName(""); setError(""); setLoginBusy(true);
    try { await request("/api/admin/session", "DELETE"); await mutate({ configured: true, authenticated: false, expiresAt: null }, false); }
    catch (err) { setError(err instanceof Error ? err.message : "Sign-out failed. Please retry."); }
    finally { setLoginBusy(false); setBusy(false); }
  }
  async function search(page = 1, query = name, mode = match) {
    const id = ++requestId.current;
    setBusy(true); setError("");
    try {
      const data = await request<AdminSearchResult>("/api/admin/search", "POST", { name: query.trim(), match: mode, page });
      if (id === requestId.current) setResults(data);
    } catch (err) {
      if (id !== requestId.current) return;
      setResults(null); setError(err instanceof Error ? err.message : "Search failed.");
      if (err instanceof AdminRequestError && err.status === 401) await mutate({ configured: true, authenticated: false, expiresAt: null }, false);
    } finally { if (id === requestId.current) setBusy(false); }
  }

  if (sessionError) return <section className="panel stack"><h1>Admin access</h1><p role="alert">Could not check your admin session.</p><button className="secondary" onClick={() => mutate()}>Retry</button></section>;
  if (!session) return <section className="panel"><p role="status">Checking admin access…</p></section>;
  if (!session.authenticated) return <section className="panel stack admin-login">
    <span className="tiny lime inline"><LockKeyhole size={17} aria-hidden="true" /> ADMIN ACCESS</span>
    <h1>Traveller records.</h1><p>Sign in to search retained trip records and visitor reports by name.</p>
    {!session.configured ? <p role="alert">Admin access is not configured. Set a strong ADMIN_SECRET of 16–512 characters in the server environment and restart or redeploy.</p>
      : <form className="stack" onSubmit={login}>
        <label className="field">Admin key<input name="adminKey" type="password" autoComplete="current-password" required maxLength={512} value={key} onChange={(event) => setKey(event.target.value)} /></label>
        <button className="primary" disabled={loginBusy}>{loginBusy ? "Signing in…" : "Sign in"}</button>
      </form>}
    {error && <p role="alert">{error}</p>}
    <small>Admin sessions expire after one hour. The key is never placed in the URL or saved in browser storage.</small>
    <Link href="/" className="linkbtn">Back to planner</Link>
  </section>;

  return <>
    <div className="section-top"><div className="stack"><span className="tiny lime inline"><Users size={17} aria-hidden="true" /> ADMIN PANEL</span>
      <h1>Find traveller records.</h1><p>Search by the name entered in a trip or visitor report.</p></div>
      <button className="secondary inline" disabled={loginBusy} onClick={logout}><LogOut size={16} aria-hidden="true" /> Sign out</button></div>
    <section className="panel stack">
      <form className="admin-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <label className="field">Traveller name<input name="name" type="search" minLength={2} maxLength={80} required placeholder="For example, Shubham Kumar" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field">Match<select value={match} onChange={(event) => setMatch(event.target.value as "contains" | "exact")}><option value="contains">Contains this name</option><option value="exact">Exact name</option></select></label>
        <button className="primary inline" disabled={busy || loginBusy}><Search size={17} aria-hidden="true" /> {busy ? "Searching…" : "Search records"}</button>
      </form>
      <small>Names are not verified identities. Records with the same name may belong to different people. Only unexpired records are searchable, usually up to 30 days. Anonymous crowd check-ins cannot be linked to names.</small>
    </section>
    {error && <p className="subpanel" role="alert">{error}</p>}
    <div aria-live="polite" aria-busy={busy} className="stack">
      {!results ? <section className="subpanel"><p>Enter at least two characters to find matching trips and reports.</p></section> : <>
        <div className="admin-results-heading"><h2>Results for “{results.name}”</h2><span className="chip">{results.match === "exact" ? "Exact match" : "Contains name"} · case insensitive</span></div>
        <div className="two-cols admin-counts"><div className="subpanel stack"><small>MATCHING TRIPS</small><strong>{results.tripCount}</strong></div><div className="subpanel stack"><small>MATCHING VISITOR REPORTS</small><strong>{results.reportCount}</strong></div></div>
        <section className="panel stack" aria-label="Matching trip records"><h2>Trips</h2>
          {results.trips.length === 0 ? <p>No matching trips on this page.</p> : results.trips.map((trip) => <article key={trip.id} className="admin-record stack">
            <div className="row"><strong>{trip.startCity} · {formatDates(trip.startDate, trip.endDate)}</strong><span className="chip">{trip.mode} · {trip.revealed ? "Revealed" : "Collecting choices"}</span></div>
            <div className="admin-record-meta"><span>Trip budget: {money(trip.maxBudgetPerPerson)} / person</span><span>{trip.participantCount} participants</span><span>Room: {trip.id}</span></div>
            {trip.hostName && <p>Matching host: <strong>{trip.hostName}</strong></p>}
            {trip.matches.map((person, index) => <div key={index} className="subpanel stack"><strong>{person.name}</strong>
              <p>Comfort budget: {money(person.comfortBudget)}</p><div className="chips">{person.vibes.map((vibe) => <span key={vibe} className="chip">{VIBE_NAMES[vibe as Vibe] || vibe}</span>)}</div>
              <small>Joined {timestamp(person.joinedAt)}</small></div>)}
            <small>Created {timestamp(trip.createdAt)} · Expires {timestamp(trip.expiresAt)}</small>
            <Link href={"/trip/" + trip.id} className="linkbtn inline" target="_blank" rel="noopener noreferrer">Open trip <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </article>)}
        </section>
        <section className="panel stack" aria-label="Matching visitor reports"><h2>Visitor reports</h2>
          {results.reports.length === 0 ? <p>No matching visitor reports on this page.</p> : results.reports.map((report) => <article key={report.id} className="admin-record stack">
            <div className="row"><strong>{report.name}</strong><span>{report.destinationId.replaceAll("-", " ")} · {formatDates(report.visitedOn, report.visitedOn)}</span></div>
            <div className="chips"><span className="chip">{WEATHER_OPTIONS[report.weather]}</span><span className="chip">{CROWD_OPTIONS[report.crowd]}</span><span className="chip">{EXPERIENCE_OPTIONS[report.experience]}</span></div>
            {report.note && <p className="visit-note">{report.note}</p>}<small>Updated {timestamp(report.updatedAt)}</small>
          </article>)}
        </section>
        {results.tripCount === 0 && results.reportCount === 0 && <p>No retained records match this name. Try a shorter name or switch to “Contains this name”.</p>}
        <nav className="panel-actions" aria-label="Search result pages"><button className="secondary" disabled={busy || results.page <= 1} onClick={() => search(results.page - 1, results.name, results.match)}>Previous</button>
          <span>Page {results.page} · up to {results.pageSize} of each record type</span><button className="secondary" disabled={busy || !results.hasMore} onClick={() => search(results.page + 1, results.name, results.match)}>Next</button></nav>
      </>}
    </div>
  </>;
}
