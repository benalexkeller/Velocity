"use client";
import { useState } from "react";
import { Cubes } from "@/components/Cubes";
import { CoachBar } from "@/components/CoachBar";
import { NUTRITION } from "@/lib/content/nutrition";

export default function NutritionPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <main className="main">
      <div className="page" style={{ display: "grid", gap: 16, paddingTop: 10 }}>
        <div className="page-head">
          <div>
            <div className="eyebrow muted">Fuel · {NUTRITION.length} topics</div>
            <h1>Nutrition</h1>
          </div>
        </div>
        <div>
          <Cubes items={NUTRITION} openId={open} onOpen={(id) => { setOpen(id); if (id) window.scrollTo({ top: 0, behavior: "smooth" }); }} columns={4} />
        </div>
        <CoachBar id="nu-coach" />
      </div>
    </main>
  );
}
