"use client";
// Route error boundary: the page broke, the app shell (nav, header) stays.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="main">
      <section className="card" style={{ padding: 24, maxWidth: 560 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>This page could not load</h1>
        <p className="muted" style={{ margin: "0 0 16px" }}>Something in the data made it fail. Your data is unchanged. Reload to try again; if it keeps failing, send it through Give feedback.</p>
        <button type="button" className="btn" onClick={() => reset()}>Reload</button>
        {error.digest && <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Reference {error.digest}</p>}
      </section>
    </main>
  );
}
