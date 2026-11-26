import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
const display = localFont({
  src: "../../../node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-800-normal.woff2",
  weight: "800",
  variable: "--display-font",
  display: "swap",
});
const bodyFont = localFont({
  src: "../../../node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2",
  weight: "400",
  variable: "--body-font",
  display: "swap",
});
import "../styles/globals.css";
import { Header, Footer } from "@frontend/components/layout/Shell";
import PageViews from "@frontend/components/layout/PageViews";
export const metadata: Metadata = {
  title: {
    default: "WeekendWise",
    template: "%s · WeekendWise",
  },
  description:
    "Find a weekend that fits your people, your vibe and your budget.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={display.variable + " " + bodyFont.variable}>
      <body>
        <Header />
        {children}
        <Footer />
        <PageViews />
      </body>
    </html>
  );
}
