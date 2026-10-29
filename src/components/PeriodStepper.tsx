"use client";
// One control for stepping through days, weeks and months: the arrows sit flush against the label,
// and the label has a fixed width per mode so the arrows do not move when the text gets longer.
import type { ReactNode } from "react";
import { Icon } from "./icons";

export function PeriodStepper({ label, onPrev, onNext, prevLabel, nextLabel, width, big = false, lead = false, prevDisabled, nextDisabled }: {
  label: ReactNode; onPrev: () => void; onNext: () => void; prevLabel: string; nextLabel: string;
  /** label width in px, the widest text of the current mode */ width: number; big?: boolean;
  /** both arrows first, then the label (the Plan page header) */ lead?: boolean; prevDisabled?: boolean; nextDisabled?: boolean;
}) {
  const Label = big || lead ? "h1" : "span";
  if (lead) {
    return (
      <div className="stepper lead" role="group" aria-label="Change period">
        <button type="button" className="stepper-btn" aria-label={prevLabel} onClick={onPrev} disabled={prevDisabled}><Icon name="back" /></button>
        <button type="button" className="stepper-btn" aria-label={nextLabel} onClick={onNext} disabled={nextDisabled}><Icon name="chevron" /></button>
        <Label className="stepper-label" style={{ width }}>{label}</Label>
      </div>
    );
  }
  return (
    <div className={`stepper${big ? " big" : ""}`} role="group" aria-label="Change period">
      <button type="button" className="stepper-btn" aria-label={prevLabel} onClick={onPrev} disabled={prevDisabled}><Icon name="back" /></button>
      <Label className="stepper-label" style={{ width }}>{label}</Label>
      <button type="button" className="stepper-btn" aria-label={nextLabel} onClick={onNext} disabled={nextDisabled}><Icon name="chevron" /></button>
    </div>
  );
}
