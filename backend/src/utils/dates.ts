export function todayIST(now = new Date()) {
  return new Date(now.getTime() + 19800000).toISOString().slice(0, 10);
}
export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(start: string, end: string) {
  return (
    (Date.parse(end + "T12:00:00Z") - Date.parse(start + "T12:00:00Z")) /
    86400000
  );
}
export function weekend(which: "this" | "next", now = new Date()) {
  const today = todayIST(now),
    day = new Date(today + "T12:00:00Z").getUTCDay();
  const fri = addDays(today, day === 0 ? -2 : 5 - day);
  const target = which === "next" ? addDays(fri, 7) : fri;
  return {
    startDate: target < today ? today : target,
    endDate: addDays(target, 2),
  };
}
export function formatDates(start: string, end: string) {
  const fmt = (s: string) =>
    new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(s + "T12:00:00Z"));
  return fmt(start) + (start === end ? "" : " – " + fmt(end));
}
