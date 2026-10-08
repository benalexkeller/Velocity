"use client";
import "./nutrition.css";
import { useState } from "react";
import { CoachBar } from "@/components/CoachBar";
import { NutritionProvider, useNutrition } from "@/lib/nutrition/store";
import { Track } from "@/components/nutrition/Track";
import { Guide } from "@/components/nutrition/Guide";
import { Supplements } from "@/components/nutrition/Supplements";
import { NutritionSetup } from "@/components/nutrition/Setup";
import { BRAND } from "@/lib/config";

type Tab = "track" | "guide" | "supplements";

export default function NutritionPage() {
  return <NutritionProvider><Nutrition /></NutritionProvider>;
}

function Nutrition() {
  const nut = useNutrition();
  const [tab, setTab] = useState<Tab>("track");
  return (
    <main className="main">
      <div className="page nu" style={{ display: "grid", gap: 14, paddingTop: 10 }}>
        <div className="page-head">
          <div>
            <h1>Nutrition</h1>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {([["track", "Track"], ["guide", "Guide"], ["supplements", "Supplements"]] as [Tab, string][]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {nut.ready && (tab === "track" ? <Track /> : tab === "guide" ? <Guide /> : <Supplements />)}
        <CoachBar id="nu-coach" />
      </div>
      {nut.needsSetup && (
        <div className="nu-modal" role="dialog" aria-modal="true" aria-label="Nutrition set-up">
          <section className="card box">
            <span className="wordmark">{BRAND.name}</span>
            <h1>Set up nutrition</h1>
            <NutritionSetup onDone={() => setTab("track")} />
          </section>
        </div>
      )}
    </main>
  );
}
