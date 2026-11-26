"use client";
export default function ErrorView({ reset }: { reset: () => void }) {
  return (
    <main className="wrap inner">
      <div className="panel">
        <h1>Connection interrupted.</h1>
        <p>Something interrupted your trip plan. Try loading it again.</p>
        <button className="primary inline" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
