"use client";
import { useState } from "react";
import { Cubes } from "@/components/Cubes";
import { CoachBar } from "@/components/CoachBar";
import { CALCULATORS } from "@/lib/content/calculators";

export default function CalculatorPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <main className="main">
      <div className="page" style={{ display: "grid", gap: 16, paddingTop: 10 }}>
        <div className="page-head">
          <div>
            <div className="eyebrow muted">Tools · {CALCULATORS.length} calculators</div>
            <h1>Calculator</h1>
          </div>
        </div>
        <div>
          <Cubes items={CALCULATORS} openId={open} onOpen={(id) => { setOpen(id); if (id) window.scrollTo({ top: 0, behavior: "smooth" }); }} columns={3} />
        </div>
        <CoachBar id="calc-coach" />
      </div>
    </main>
  );
}
