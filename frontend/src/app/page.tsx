import Landing from "@frontend/components/home/Landing";
import { weekend } from "@backend/utils/dates";
import { PRIVACY } from "@backend/types/index";
import {
  MapPin,
  Compass,
  CloudSun,
  MessageCircle,
  Share2,
  ArrowDownRight,
  Navigation,
} from "lucide-react";
export const revalidate = 60;
const steps = [
  {
    icon: Compass,
    title: "Decide together",
    text: "Vote on the vibe and find a weekend that fits everyone’s budget.",
  },
  {
    icon: CloudSun,
    title: "Check the scene",
    text: "Weather, estimated crowds and the best way to get there.",
  },
  {
    icon: MessageCircle,
    title: "Convince the parents",
    text: "A ready-to-send Parent Pack for the family WhatsApp.",
  },
  {
    icon: Share2,
    title: "Share the plan",
    text: "One trip link and a share card for the whole gang.",
  },
];
export default function Home() {
  return (
    <main>
      <section className="hero">
        <picture className="scenery">
          <source
            media="(max-width:640px)"
            srcSet="/images/himachal-valley-mobile.webp"
          />
          <img alt="" fetchPriority="high" src="/images/himachal-valley.webp" />
        </picture>
        <div className="wash" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> THE WEEKEND FIELD GUIDE
            </div>
            <h1>
              Plan your
              <br />
              <em>weekend.</em>
            </h1>
            <p>
              Turn the group chat into a getaway. Find your vibe, check the weather and crowds, and get your family on board.
            </p>
            <div className="geo">
              <Navigation size={15} />{" "}
              <span>
                FIELD NOTES <i>/</i> HIMACHAL PRADESH
              </span>
            </div>
          </div>
          <Landing initial={weekend("this")} />
        </div>
      </section>
      <section id="how" className="wrap how">
        <div className="eyebrow">
          <span /> HOW IT WORKS
        </div>
        <div className="how-title">
          <h2>One link. Your whole plan.</h2>
          <ArrowDownRight aria-hidden="true" size={30} />
        </div>
        <div className="step-grid">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <article key={title}>
              <div className="step-top">
                <Icon size={23} strokeWidth={1.6} />
                <small>0{i + 1}</small>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className="privacy">
          <MapPin size={14} />
          {PRIVACY}
        </p>
      </section>
    </main>
  );
}
