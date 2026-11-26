import Link from "next/link";
import { Mountain, Compass, ArrowUpRight } from "lucide-react";
import { FOOTER } from "@backend/types/index";
export function Header() {
  return (
    <header className="mast">
      <div className="wrap mast-inner">
        <Link href="/" aria-label="WeekendWise home" className="logo">
          <Mountain aria-hidden="true" />
          <span>
            Weekend<span className="lime">Wise</span>
          </span>
        </Link>
        <div className="mast-right">
          <span className="live-dot" />
          <span className="tiny desk">WEEKEND TRIP PLANNER</span>
          <span className="mast-divider" />
          <Link href="/updates" className="navlink">Traveller updates</Link>
          <a href="/#how" className="navlink desk">
            How it works <ArrowUpRight size={15} />
          </a>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <Compass size={17} aria-hidden="true" />
        <span>{FOOTER}</span>
      </div>
    </footer>
  );
}
export function Expired() {
  return (
    <main className="wrap inner">
      <div className="panel">
        <Mountain className="lime" />
        <h1>Trip link expired?</h1>
        <p>
          This room expired or the link is incomplete. Make a new one for the
          next weekend.
        </p>
        <Link className="primary inline" href="/">
          Plan a weekend →
        </Link>
      </div>
    </main>
  );
}
