"use client";
// Admin: Overview, Users (with membership and account actions), Coach (usage and cost), Library, Inbox, System.
// Every number comes from database functions that answer only the admin (supabase/schema-admin.sql); athletes' own
// data (workouts, body data, meals, coach messages, calendar events) is never shown here.
import "../account.css";
import "./admin.css";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePlan } from "@/lib/store";
import { listFeedback } from "@/lib/feedback";
import { LibraryAdmin } from "@/components/admin/Library";
import { Overview } from "@/components/admin/Overview";
import { Users } from "@/components/admin/Users";
import { Coach } from "@/components/admin/Coach";
import { Inbox } from "@/components/admin/Inbox";
import { System } from "@/components/admin/System";

const TABS = [
  { k: "overview", label: "Overview" },
  { k: "users", label: "Users" },
  { k: "coach", label: "Coach" },
  { k: "library", label: "Library" },
  { k: "inbox", label: "Inbox" },
  { k: "system", label: "System" },
] as const;
type Tab = (typeof TABS)[number]["k"];

export default function AdminPage() {
  return <Suspense fallback={null}><Admin /></Suspense>;
}

function Admin() {
  const plan = usePlan();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const tab: Tab = TABS.some((t) => t.k === params.get("tab")) ? (params.get("tab") as Tab) : "overview";
  const [openInbox, setOpenInbox] = useState<number | null>(null);
  const isAdmin = plan.accounts && plan.athlete.isAdmin;
  useEffect(() => { if (isAdmin) listFeedback().then((f) => setOpenInbox(f.filter((e) => e.status !== "done").length), () => {}); }, [isAdmin, tab]);

  const shell = (body: React.ReactNode) => <main className="main"><div className="adm"><div className="page-head"><h1>Admin</h1></div>{body}</div></main>;
  if (!plan.accounts) return shell(<p className="muted">Admin tools arrive with accounts.</p>);
  if (!plan.ready) return shell(<p className="muted">Loading…</p>);
  if (!plan.athlete.isAdmin) return shell(<p className="muted">This page is for the admin account.</p>);
  const go = (k: Tab) => router.replace(k === "overview" ? path : `${path}?tab=${k}`, { scroll: false });
  return shell(
    <>
      <div className="tabs-row">
        <div className="pill-group" role="tablist" aria-label="Admin sections">
          {TABS.map((t) => (
            <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={tab === t.k ? "on" : ""} onClick={() => go(t.k)}>
              {t.label}{t.k === "inbox" && openInbox ? <span className="c">{openInbox}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users />}
      {tab === "coach" && <Coach />}
      {tab === "library" && <LibraryAdmin />}
      {tab === "inbox" && <Inbox />}
      {tab === "system" && <System />}
    </>
  );
}
