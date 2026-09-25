export function Placeholder({ title }: { title: string }) {
  return (
    <main className="main">
      <div className="card" style={{ padding: 28, marginTop: 10 }}>
        <div className="eyebrow muted">Coming next</div>
        <h1 style={{ fontSize: 26, marginTop: 6 }}>{title}</h1>
        <p className="muted" style={{ maxWidth: "60ch" }}>This page will be designed in the same system as the Dashboard and Plan. Nothing here is final.</p>
      </div>
    </main>
  );
}
