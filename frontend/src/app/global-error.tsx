"use client";
import { FOOTER } from "@backend/types/index";
export default function ErrorView({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main>
          <h1>Trip page unavailable</h1>
          <button onClick={reset}>Try again</button>
        </main>
        <footer>{FOOTER}</footer>
      </body>
    </html>
  );
}
