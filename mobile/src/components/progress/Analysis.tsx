// Progress, Analysis (PR's rebuilt design, 6 Nov 2026): a blue header with Run, Bike, Swim and the score arc;
// a card with the last four weeks (plan completed, in target zone, longest, pace and distance charts, one line of
// what changed); training volume by week, month or year; body readings; performance.
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { paceEligible, paceOf } from "@shared/analysis";
import type { Activity } from "@shared/data";
import { DAYS, addDays, fmtHMS, fmtPace, today as todayDate, ymd } from "@shared/format";
import { dist, runPace, speed, swimDist, swimPace } from "@shared/units";
import { Icon, type IconName } from "../Icon";
import { AreaLine, AxisBars, RangePills, ScoreArc, StackBars } from "./charts";
import { useAthlete } from "@/lib/athlete";
import { LIGHT, useTheme, type Palette } from "@/lib/theme";

type Sp = "run" | "bike" | "swim";
const LABEL: Record<Sp, string> = { run: "Run", bike: "Bike", swim: "Swim" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const hm = (h: number) => { const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`; };
const dd = (d: Date) => `${MON[d.getMonth()]} ${d.getDate()}`;

const paceOut = (sp: Sp, v: number) => (sp === "bike" ? speed(v).v.toFixed(1) : fmtPace(sp === "run" ? runPace(v).s : swimPace(v).s));
const paceUnit = (sp: Sp) => (sp === "bike" ? speed(1).u : sp === "run" ? runPace(1).u : swimPace(1).u);
const distOf = (sp: Sp, a: Activity) => (sp === "swim" ? a.yd ?? 0 : a.mi ?? 0);
const distOut = (sp: Sp, v: number) => (sp === "swim" ? swimDist(v).v.toLocaleString() : dist(v).v.toFixed(v >= 10 ? 0 : 1));
const distUnit = (sp: Sp) => (sp === "swim" ? swimDist(1).u : dist(1).u);
const wavgPace = (sp: Sp, xs: Activity[]) => { const v = xs.filter((a) => paceEligible(a, sp) && paceOf(a, sp) != null); const w = v.reduce((n, a) => n + a.min, 0); return w ? v.reduce((n, a) => n + (paceOf(a, sp) as number) * a.min, 0) / w : null; };

function Tile({ icon, k, v, c }: { icon: IconName; k: string; v: string; c: Palette }) {
  return (
    <View style={[st.tile, { backgroundColor: c.surface2 }]}>
      <Icon name={icon} size={24} color={c.accent} />
      <View><Text style={[st.tileK, { color: c.ink2 }]}>{k}</Text><Text style={[st.tileV, { color: c.ink }]}>{v}</Text></View>
    </View>
  );
}

export function Analysis() {
  const { c, dark } = useTheme();
  const { data } = useAthlete();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 700);
  const [sp, setSp] = useState<Sp>("run");
  const [mode, setMode] = useState<"week" | "month" | "year">("week");
  const [off, setOff] = useState(0);
  const t = todayDate();
  const monday = addDays(t, -((t.getDay() + 6) % 7));

  const four = useMemo(() => {
    if (!data) return null;
    const acts = data.activities.filter((a) => a.sport === sp);
    const weeks = Array.from({ length: 4 }, (_, i) => addDays(monday, (i - 3) * 7));
    const inW = (w0: Date) => acts.filter((a) => a.date >= ymd(w0) && a.date < ymd(addDays(w0, 7)));
    const from = ymd(weeks[0]), to = ymd(t);
    const recent = acts.filter((a) => a.date >= from && a.date <= to);
    const before = acts.filter((a) => a.date >= ymd(addDays(weeks[0], -28)) && a.date < from);
    const planned = data.weeks.flatMap((w) => w.sessions).filter((s) => (s.sport === sp || (s.sport === "brick" && sp !== "swim")) && s.date >= from && s.date <= to && !(s.date === to && !s.actual));
    const verdicts = recent.map((a) => data.an.analyzeActivity(a).verdict).filter(Boolean);
    const dNow = recent.reduce((n, a) => n + distOf(sp, a), 0), dBefore = before.reduce((n, a) => n + distOf(sp, a), 0);
    const pace = weeks.map((w) => wavgPace(sp, inW(w)));
    const p0 = pace.find((p) => p != null), p1 = [...pace].reverse().find((p) => p != null);
    const parts: string[] = [];
    if (dBefore > 0) { const pct = ((dNow - dBefore) / dBefore) * 100; parts.push(`${Math.abs(pct) < 3 ? "Same distance as" : pct > 0 ? `${pct.toFixed(0)}% more distance than` : `${Math.abs(pct).toFixed(0)}% less distance than`} the 4 weeks before`); }
    if (p0 != null && p1 != null && p0 !== p1) { const better = sp === "bike" ? p1 > p0 : p1 < p0; const pct = Math.abs((p1 - p0) / p0) * 100; parts.push(pct < 1 ? `${sp === "bike" ? "speed" : "pace"} steady` : `${sp === "bike" ? "speed" : "pace"} ${pct.toFixed(0)}% ${better ? (sp === "bike" ? "higher" : "faster") : (sp === "bike" ? "lower" : "slower")}`); }
    return {
      weeks, done: planned.filter((s) => s.status === "done").length, planned: planned.length,
      zone: verdicts.length ? Math.round((verdicts.filter((v) => v === "in range").length / verdicts.length) * 100) : null,
      longest: recent.reduce((m, a) => Math.max(m, distOf(sp, a)), 0),
      pace, dist: weeks.map((w) => inW(w).reduce((n, a) => n + distOf(sp, a), 0)),
      insight: parts.length ? `${parts.join(", ")}.`.replace(/^\w/, (m) => m.toUpperCase()) : `Log a few more ${LABEL[sp].toLowerCase()} sessions to see trends.`,
    };
  }, [data, sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const volume = useMemo(() => {
    if (!data) return null;
    const sessions = data.weeks.flatMap((w) => w.sessions).filter((s) => s.sport !== "rest");
    const bucket = (a: string, b: string, label: string) => {
      const acts = data.activities.filter((x) => x.date >= a && x.date <= b);
      const h = (f: (x: Activity) => boolean) => acts.filter(f).reduce((n, x) => n + x.min, 0) / 60;
      return { label, run: h((x) => x.sport === "run"), bike: h((x) => x.sport === "bike"), swim: h((x) => x.sport === "swim"), other: h((x) => !["run", "bike", "swim"].includes(x.sport)), planned: sessions.filter((s) => s.date >= a && s.date <= b).reduce((n, s) => n + s.min, 0) / 60 };
    };
    if (mode === "week") {
      const w0 = addDays(monday, off * 7);
      return { title: `${dd(w0)} to ${dd(addDays(w0, 6))}`, buckets: Array.from({ length: 7 }, (_, i) => { const d = ymd(addDays(w0, i)); return bucket(d, d, DAYS[i]); }) };
    }
    if (mode === "month") {
      const m = new Date(t.getFullYear(), t.getMonth() + off, 1), last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      const out = []; let w = addDays(m, -((m.getDay() + 6) % 7));
      while (w <= last) { const a = w < m ? m : w, b = addDays(w, 6) > last ? last : addDays(w, 6); out.push(bucket(ymd(a), ymd(b), `${a.getDate()}`)); w = addDays(w, 7); }
      return { title: `${MONTH[m.getMonth()]} ${m.getFullYear()}`, buckets: out };
    }
    const y = t.getFullYear() + off;
    return { title: String(y), buckets: Array.from({ length: 12 }, (_, i) => bucket(ymd(new Date(y, i, 1)), ymd(new Date(y, i + 1, 0)), MON[i].slice(0, 1))) };
  }, [data, mode, off]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !four || !volume) return null;
  const sc = data.an.sessionScore(sp);
  const body = [...data.raw.body].reverse();
  const latest = (k: "sleep_h" | "hrv" | "rhr") => { const r = body.find((b) => b[k] != null); return r ? Number(r[k]) : null; };
  const sleep = latest("sleep_h"), hrv = latest("hrv"), rhr = latest("rhr");
  const kg = data.raw.weightKg;
  const metric = data.athlete.units === "metric";
  const all = data.activities.filter((a) => a.sport === sp);
  const longestAll = all.reduce<Activity | null>((m, a) => (distOf(sp, a) > (m ? distOf(sp, m) : 0) ? a : m), null);
  const best = (() => {
    if (sp === "run") { const r = all.filter((a) => (a.mi ?? 0) >= 3.1 && a.pace_s).sort((a, b) => a.pace_s! - b.pace_s!)[0]; return r ? { k: "Best 5K", v: fmtHMS((r.pace_s! * 3.10686) / 60) } : null; }
    if (sp === "bike") { const r = all.filter((a) => a.min >= 60 && a.mph).sort((a, b) => b.mph! - a.mph!)[0]; return r ? { k: "Best Speed, 1 h+", v: `${speed(r.mph!).v.toFixed(1)} ${speed(1).u}` } : null; }
    const r = all.filter((a) => (a.yd ?? 0) >= 1000 && a.p100_s).sort((a, b) => a.p100_s! - b.p100_s!)[0];
    return r ? { k: "Best Pace", v: `${fmtPace(swimPace(r.p100_s!).s)} ${swimPace(1).u}` } : null;
  })();
  const cardW = W - 32 - 28;
  const half = (cardW - 16) / 2;
  const sportCol = { run: dark ? "#3A4A7A" : LIGHT.run, bike: LIGHT.bike, swim: dark ? "#7FA6F5" : "#A9C8FA", other: dark ? "#3A3F4A" : "#C9CDD4", plan: dark ? "#D6D9DF" : "#101114" };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
      {/* blue header: sport switch and the score */}
      <View style={[st.hero, { backgroundColor: LIGHT.accent }]}>
        <View style={st.seg}>
          {(["run", "bike", "swim"] as const).map((k) => (
            <Pressable key={k} onPress={() => setSp(k)} style={[st.segBtn, sp === k && { backgroundColor: "#fff" }]} accessibilityRole="button" accessibilityState={{ selected: sp === k }}>
              <Text style={[st.segText, { color: sp === k ? "#101114" : "rgba(255,255,255,0.88)" }]}>{LABEL[k]}</Text>
            </Pressable>
          ))}
        </View>
        <ScoreArc score={sc?.score ?? null} label={`${LABEL[sp]} Score`} />
      </View>

      {/* the last four weeks */}
      <View style={[st.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[st.eyebrow, { color: c.ink2 }]}>{LABEL[sp]}, Last 4 Weeks</Text>
        <View style={st.three}>
          {[
            { k: "Plan Completed", v: four.planned ? `${four.done} / ${four.planned}` : "-" },
            { k: "In Target Zone", v: four.zone != null ? `${four.zone}%` : "-" },
            { k: sp === "swim" ? "Longest Swim" : sp === "bike" ? "Longest Ride" : "Longest Run", v: four.longest ? `${distOut(sp, four.longest)} ${distUnit(sp)}` : "-" },
          ].map((x, i) => (
            <View key={x.k} style={[st.third, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.line }]}>
              <Text style={[st.thirdK, { color: c.ink2 }]}>{x.k}</Text>
              <Text style={[st.thirdV, { color: c.ink }]}>{x.v}</Text>
            </View>
          ))}
        </View>
        <View style={st.charts}>
          <View style={{ width: half }}>
            <Text style={[st.chartT, { color: c.ink }]}>{sp === "bike" ? "Speed" : "Pace"} <Text style={{ color: c.muted, fontWeight: "400" }}>({paceUnit(sp).replace(/^\//, "min/")})</Text></Text>
            <AreaLine values={four.pace} labels={four.weeks.map((w) => dd(w).replace(" ", ""))} width={half} color={c.accent} lowerIsBetter={sp !== "bike"} fmt={(v) => paceOut(sp, v)} c={c} />
          </View>
          <View style={{ width: half }}>
            <Text style={[st.chartT, { color: c.ink }]}>Distance <Text style={{ color: c.muted, fontWeight: "400" }}>({distUnit(sp)})</Text></Text>
            <AxisBars values={four.dist} labels={four.weeks.map((w) => dd(w).replace(" ", ""))} width={half} color={c.accent} fmt={(v) => distOut(sp, v)} c={c} />
          </View>
        </View>
        <View style={[st.insight, { backgroundColor: c.accentSoft }]}>
          <Icon name="trend" size={18} color={c.accent} stroke={2} />
          <Text style={[st.insightText, { color: c.accent }]}>{four.insight}</Text>
        </View>
      </View>

      {/* volume */}
      <View style={[st.section, { borderTopColor: c.line }]}>
        <View style={st.secHead}>
          <Text style={[st.h1, { color: c.ink }]}>Training Volume</Text>
          <View style={[st.pill, { backgroundColor: c.surface2 }]}><Text style={[st.pillText, { color: c.ink2 }]}>All Sports</Text></View>
        </View>
        <Text style={[st.sub, { color: c.muted }]}>Combined swim, bike and run</Text>
        <View style={st.volBar}>
          <RangePills options={[{ k: "week", label: "Week" }, { k: "month", label: "Month" }, { k: "year", label: "Year" }]} value={mode} onChange={(m) => { setMode(m); setOff(0); }} />
          <View style={st.nav}>
            <Pressable onPress={() => setOff((o) => o - 1)} hitSlop={8} accessibilityLabel="Earlier"><Icon name="back" size={16} color={c.ink} stroke={2.2} /></Pressable>
            <Text style={[st.navText, { color: c.ink }]}>{volume.title}</Text>
            <Pressable onPress={() => setOff((o) => Math.min(0, o + 1))} hitSlop={8} accessibilityLabel="Later" style={{ opacity: off < 0 ? 1 : 0.3 }}><Icon name="chevron" size={16} color={c.ink} stroke={2.2} /></Pressable>
          </View>
        </View>
        <StackBars buckets={volume.buckets} width={W - 32} colors={sportCol} c={c} />
        <View style={st.legend}>
          {([["Swim", sportCol.swim, false], ["Bike", sportCol.bike, false], ["Run", sportCol.run, false], ["Planned", sportCol.plan, true]] as const).map(([l, col, outline]) => (
            <View key={l} style={st.leg}><View style={[st.legSq, outline ? { borderWidth: 1.5, borderColor: col } : { backgroundColor: col }]} /><Text style={[st.legText, { color: c.ink2 }]}>{l}</Text></View>
          ))}
        </View>
      </View>

      {/* body */}
      <View style={[st.section, { borderTopColor: c.line }]}>
        <View style={st.secHead}><Text style={[st.h1, { color: c.ink }]}>Body</Text><Text style={[st.sub, { color: c.muted, marginTop: 4 }]}>Latest Readings</Text></View>
        <View style={st.grid}>
          <Tile icon="bed" k="Sleep" v={sleep != null ? `${Math.floor(sleep)}h ${String(Math.round((sleep % 1) * 60)).padStart(2, "0")}m` : "-"} c={c} />
          <Tile icon="pulse" k="HRV" v={hrv != null ? `${Math.round(hrv)} ms` : "-"} c={c} />
          <Tile icon="heart" k="Resting HR" v={rhr != null ? `${Math.round(rhr)} bpm` : "-"} c={c} />
          <Tile icon="scale" k="Weight" v={kg != null ? (metric ? `${kg.toFixed(1)} kg` : `${Math.round(kg * 2.20462)} lb`) : "-"} c={c} />
        </View>
      </View>

      {/* performance */}
      <View style={[st.section, { borderTopColor: c.line }]}>
        <View style={st.secHead}>
          <Text style={[st.h1, { color: c.ink }]}>Performance</Text>
          <View style={[st.pill, { backgroundColor: c.surface2 }]}><Text style={[st.pillText, { color: c.ink2 }]}>{LABEL[sp]}</Text></View>
        </View>
        <View style={st.grid}>
          <Tile icon="medal" k={best?.k ?? "Best Effort"} v={best?.v ?? "-"} c={c} />
          <Tile icon="route" k={sp === "swim" ? "Longest Swim" : sp === "bike" ? "Longest Ride" : "Longest Run"} v={longestAll ? `${distOut(sp, distOf(sp, longestAll))} ${distUnit(sp)}` : "-"} c={c} />
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 40 },
  seg: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, padding: 3, marginBottom: 2 },
  segBtn: { paddingHorizontal: 22, paddingVertical: 6, borderRadius: 17 },
  segText: { fontSize: 15, fontWeight: "600" },
  card: { marginHorizontal: 16, marginTop: -34, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 14, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  eyebrow: { fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  three: { flexDirection: "row" },
  third: { flex: 1, alignItems: "center", gap: 3 },
  thirdK: { fontSize: 12 },
  thirdV: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  charts: { flexDirection: "row", gap: 16 },
  chartT: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  insight: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, borderRadius: 12 },
  insightText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  section: { marginTop: 22, marginHorizontal: 16, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  secHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  h1: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  sub: { fontSize: 13, marginTop: -6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  pillText: { fontSize: 12, fontWeight: "600" },
  volBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  nav: { flexDirection: "row", alignItems: "center", gap: 10 },
  navText: { fontSize: 13, fontWeight: "700" },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center" },
  leg: { flexDirection: "row", alignItems: "center", gap: 6 },
  legSq: { width: 12, height: 12, borderRadius: 3 },
  legText: { fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.8%", flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14 },
  tileK: { fontSize: 12 },
  tileV: { fontSize: 20, fontWeight: "700", letterSpacing: -0.3, marginTop: 1 },
});
