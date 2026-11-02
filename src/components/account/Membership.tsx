"use client";
// Profile → Plan: the athlete's membership (Free, Trial, Pro, Free Pro), as two cells of the card's key-value grid.
import { useEffect, useState } from "react";
import { MEMBERSHIP, myMembership, type Membership as M } from "@/lib/admin/api";
import { dateFull } from "@/lib/format";

export function Membership() {
  const [m, setM] = useState<{ status: M; ends: string | null } | null>(null);
  useEffect(() => { myMembership().then(setM); }, []);
  if (!m) return null;
  const end = m.ends ? dateFull(m.ends.slice(0, 10)) : null;
  const text = m.status === "ended" ? `Ended${end ? ` ${end}` : ""}, now Free` : `${MEMBERSHIP[m.status]}${end ? `, until ${end}` : m.status === "free_pro" ? ", no end date" : ""}`;
  return <><span>Membership</span><span>{text}</span></>;
}
