"use client";
import "../account.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/config";
import { usePlan } from "@/lib/store";
import { ProfileForm } from "@/components/account/ProfileForm";
import { ConnectWearable } from "@/components/ConnectWearable";

// First sign-in: the profile and race, then the app. PR's account can pull in the seed data here.
export default function SetupPage() {
  const plan = usePlan();
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const canImport = plan.accounts && plan.athlete.isAdmin && !plan.hasPlan;
  return (
    <main className="auth" style={{ alignItems: "start", paddingTop: 40 }}>
      <section className="card box" style={{ maxWidth: 720 }}>
        <span className="wordmark">{BRAND.name}</span>
        <h1>Set up your profile</h1>
        {canImport && (
          <div className="form" style={{ padding: 12, border: "1px solid var(--line)", borderRadius: 10 }}>
            <b style={{ fontSize: 13 }}>Your existing data</b>
            <span className="hint">Moves the plan, activities and body data saved in this browser into this account.</span>
            <div className="row"><button type="button" className="btn ghost" disabled={importing || imported} onClick={async () => { setImporting(true); try { await plan.importSeed(); setImported(true); } finally { setImporting(false); } }}>{imported ? "Imported ✓" : importing ? "Importing…" : "Import my data"}</button></div>
          </div>
        )}
        <div className="form setup-wearable" style={{ padding: 14, border: "1px solid var(--line)", borderRadius: 12, marginBottom: 8 }}>
          <b style={{ fontSize: 14 }}>Your watch</b>
          <span className="hint">Optional. Not connected yet.</span>
          <div className="row"><ConnectWearable /></div>
        </div>
        <ProfileForm mode="setup" onSaved={() => { router.replace(imported ? "/dashboard" : "/plan/new"); router.refresh(); }} />
      </section>
    </main>
  );
}
