"use client";
// Admin → Library: the coach's reference passages. Bundled ones are listed read-only; rows in the database can
// be added, edited (a row with a bundled id replaces that passage) and removed.
import { useEffect, useState } from "react";
import { PASSAGES } from "@/lib/coach/library-data";
import type { Passage } from "@/lib/coach/library";
import { deleteLibraryRow, listLibraryRows, saveLibraryRow, type LibraryRow } from "@/lib/coach/library-admin";

const TOPICS: Passage["topic"][] = ["training", "metrics", "nutrition", "recovery", "injury", "race", "environment", "equipment"];
const EMPTY: Omit<LibraryRow, "updated_at"> = { id: "", title: "", topic: "training", grade: "C", tags: [], body: "", source: "", url: null, published: true };

export function LibraryAdmin() {
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<Omit<LibraryRow, "updated_at"> | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => listLibraryRows().then(setRows).catch((e) => setErr(e instanceof Error && /library/.test(e.message) ? "Run supabase/schema-coach.sql to enable library editing." : e instanceof Error ? e.message : "Could not load."));
  useEffect(() => { void load(); }, []);
  const dbIds = new Set((rows ?? []).map((r) => r.id));
  const all: (Passage & { db?: boolean; published?: boolean })[] = [...(rows ?? []).map((r) => ({ ...r, db: true })), ...PASSAGES.filter((p) => !dbIds.has(p.id))];
  const shown = all.filter((p) => !q || `${p.id} ${p.title} ${p.tags.join(" ")} ${p.body}`.toLowerCase().includes(q.toLowerCase()));
  async function save() {
    if (!edit) return;
    const id = edit.id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!id || !edit.title.trim() || !edit.body.trim() || !edit.source.trim()) { setErr("Id, title, passage and source are required."); return; }
    setBusy(true); setErr(null);
    try { await saveLibraryRow({ ...edit, id, tags: edit.tags.map((t) => t.trim()).filter(Boolean) }); setEdit(null); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save."); }
    setBusy(false);
  }
  async function remove(id: string) { setBusy(true); try { await deleteLibraryRow(id); await load(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not delete."); } setBusy(false); }
  return (
    <>
      <div className="page-head" style={{ marginTop: 28 }}>
        <div><h1>Library</h1><div className="muted sub">{all.length} passages · {PASSAGES.length} bundled · {(rows ?? []).length} in the database</div></div>
        <span className="grow" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search passages" aria-label="Search passages" style={{ marginRight: 8 }} />
        <button type="button" className="btn small" onClick={() => setEdit({ ...EMPTY })}>Add passage</button>
      </div>
      {err && <div className="form"><div className="err">{err}</div></div>}
      {edit && (
        <div className="card form" style={{ padding: 16, marginBottom: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 100px", gap: 8 }}>
            <label>Id (slug)<input value={edit.id} onChange={(e) => setEdit({ ...edit, id: e.target.value })} placeholder="e.g. cramps" /></label>
            <label>Title<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label>Topic<select value={edit.topic} onChange={(e) => setEdit({ ...edit, topic: e.target.value as Passage["topic"] })}>{TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label>Evidence<select value={edit.grade} onChange={(e) => setEdit({ ...edit, grade: e.target.value as Passage["grade"] })}><option value="A">A strong</option><option value="B">B some</option><option value="C">C limited</option></select></label>
          </div>
          <label>Tags (comma-separated: the words athletes use)<input value={edit.tags.join(", ")} onChange={(e) => setEdit({ ...edit, tags: e.target.value.split(",") })} /></label>
          <label>Passage (80–250 words, facts only)<textarea rows={7} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
            <label>Source (as it should be cited)<input value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value })} /></label>
            <label>Link (optional)<input value={edit.url ?? ""} onChange={(e) => setEdit({ ...edit, url: e.target.value || null })} /></label>
          </div>
          <div className="row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="btn" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save passage"}</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Cancel</button>
            <label style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> Published</label>
          </div>
        </div>
      )}
      <div className="card" style={{ overflow: "auto" }}>
        <table className="tbl small">
          <thead><tr><th>Id</th><th>Title</th><th>Topic</th><th>Ev.</th><th>Tags</th><th>Source</th><th></th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={p.db && p.published === false ? "muted" : ""}>
                <td style={{ whiteSpace: "nowrap" }}>{p.id}{p.db && <span className="muted"> · db</span>}</td>
                <td style={{ minWidth: 180 }}>{p.title}</td><td>{p.topic}</td><td>{p.grade}</td>
                <td className="muted" style={{ fontSize: 11.5, maxWidth: 260 }}>{p.tags.slice(0, 8).join(", ")}{p.tags.length > 8 ? "…" : ""}</td>
                <td className="muted" style={{ fontSize: 11.5, maxWidth: 260 }}>{p.source}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="btn ghost small" onClick={() => setEdit({ id: p.id, title: p.title, topic: p.topic, grade: p.grade, tags: p.tags, body: p.body, source: p.source, url: p.url, published: p.published ?? true })}>{p.db ? "Edit" : "Override"}</button>
                  {p.db && <button type="button" className="btn ghost small" style={{ marginLeft: 6 }} disabled={busy} onClick={() => void remove(p.id)}>Remove</button>}
                </td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={7} className="muted" style={{ padding: 20 }}>No passages match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
