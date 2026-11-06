// Progress, Analysis: how the training is going, top to bottom. The three sport scores (tap one to see its numbers
// and charts), weekly volume over a chosen range, body and key facts, then race performance.
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { addDays, fmtPace, today as todayDate, ymd } from "@shared/format";
import { dist, runPace, speed, swimDist, swimPace } from "@shared/units";
import { SportIcon } from "../SportIcon";
import { Bars, Gauge, LineChart, RangePills, Spark } from "./charts";
import { useAthlete } from "@/lib/athlete";
import { useTheme, type Palette } from "@/lib/theme";

type Sp = "run" | "bike" | "swim";
const SPORTS: { k: Sp; label: string }[] = [{ k: "run", label: "Run" }, { k: "bike", label: "Bike" }, { k: "swim", label: "Swim" }];
const hmm = (h: number) => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;
const hm = (h: number) => { const m = Math.round(h * 60); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`; };

function paceText(sp: Sp, v: number) {
  if (sp === "bike") { const x = speed(v); return { v: x.v.toFixed(1), u: x.u }; }
  const x = sp === "run" ? runPace(v) : swimPace(v);
  return { v: fmtPace(x.s), u: x.u };
}
function distText(sp: Sp, v: number) {
  if (sp === "swim") { const x = swimDist(v); return { v: x.v.toLocaleString(), u: x.u }; }
  const x = dist(v); return { v: x.v.toFixed(1), u: x.u };
}

function Card({ title, right, children, c }: { title: string; right?: React.ReactNode; children: React.ReactNode; c: Palette }) {
  return (
    <View style={[st.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={st.cardHead}><Text style={[st.h2, { color: c.ink }]}>{title}</Text>{right}</View>
      {children}
    </View>
  );
}

function Delta({ pct, better, c }: { pct: number | null; better: boolean | null; c: Palette }) {
  if (pct == null || !isFinite(pct)) return null;
  const col = better == null ? c.muted : better ? c.ok : c.danger;
  return <Text style={[st.delta, { color: col }]}>{pct > 0 ? "+" : ""}{Math.abs(pct) < 0.5 ? "0" : pct.toFixed(0)}%</Text>;
}

export function Analysis() {
  const { c } = useTheme();
  const { data } = useAthlete();
  const { width } = useWindowDimensions();
  const W = Math.min(width, 700) - 32 - 32; // inside a card
  const [sp, setSp] = useState<Sp>("run");
  const [range, setRange] = useState<"4" | "12" | "26" | "all">("12");
  if (!data) return null;
  const { an, athlete, activities } = data;

  // ---------- scores and the chosen sport ----------
  const score = (s: Sp) => an.sessionScore(s);
  const perf = an.sportPerformance(sp);
  const sc = score(sp);
  const pace = an.paceSeries(sp, 84).slice(-14);
  const t = todayDate();
  const monday = addDays(t, -((t.getDay() + 6) % 7));
  const weeks12 = Array.from({ length: 12 }, (_, i) => addDays(monday, (i - 11) * 7));
  const distWeek = weeks12.map((w0) => activities.filter((a) => a.sport === sp && a.date >= ymd(w0) && a.date < ymd(addDays(w0, 7))).reduce((n, a) => n + (sp === "swim" ? a.yd ?? 0 : a.mi ?? 0), 0));
  const rowsOut = perf.rows.map((r) => {
    const better = r.cur == null || r.prev == null ? null : r.kind === "hr" ? null : r.kind === "pace" ? r.cur < r.prev : r.cur > r.prev;
    const pct = r.cur != null && r.prev ? ((r.cur - r.prev) / r.prev) * 100 : null;
    const val = r.cur == null ? { v: "-", u: "" } : r.kind === "hr" ? { v: String(Math.round(r.cur)), u: "bpm" } : r.kind === "dist" ? distText(sp, r.cur) : paceText(sp, r.cur);
    return { k: r.k.replace(/\b\w/g, (m) => m.toUpperCase()), val, pct, better };
  });
  const p0 = perf.rows[0];
  const summary = p0?.cur != null
    ? `${p0.k} ${paceText(sp, p0.cur).v} ${paceText(sp, p0.cur).u} over your last ${perf.sessions} ${sp === "run" ? "runs" : sp === "bike" ? "rides" : "swims"}${p0.prev != null ? `, ${Math.abs(((p0.cur - p0.prev) / p0.prev) * 100).toFixed(0)}% ${(p0.kind === "pace" ? p0.cur < p0.prev : p0.cur > p0.prev) ? "better" : "slower"} than the ${perf.prevSessions} before` : ""}.`
    : `No ${SPORTS.find((x) => x.k === sp)!.label.toLowerCase()} sessions yet.`;

  // ---------- volume ----------
  const vol = an.volumeWeekly(range === "all" ? 999 : +range);
  const volDone = vol.map((w) => w.actual.swim + w.actual.bike + w.actual.run + w.actual.other);
  const avg = volDone.length ? volDone.reduce((a, b) => a + b, 0) / volDone.length : 0;
  const volTop = Math.max(1, ...vol.map((w, i) => Math.max(volDone[i], w.plannedH)));
  const slot = W / Math.max(1, vol.length), bw = Math.max(3, Math.min(14, slot * 0.6)), VH = 110;

  // ---------- body and key facts ----------
  const b7 = an.bodySummary(7), b7p = an.bodySummary(7, 7);
  const body = [
    { k: "Resting HR", v: b7.rhr, prev: b7p.rhr, u: "bpm", f: (x: number) => String(Math.round(x)), s: an.bodySeries("rhr", 56), lowerBetter: true },
    { k: "HRV", v: b7.hrv, prev: b7p.hrv, u: "ms", f: (x: number) => String(Math.round(x)), s: an.bodySeries("hrv", 56), lowerBetter: false },
    { k: "Sleep", v: b7.sleep, prev: b7p.sleep, u: "h", f: hmm, s: an.bodySeries("sleep_h", 56), lowerBetter: false },
    { k: "VO2 Max", v: b7.vo2, prev: null, u: "", f: (x: number) => x.toFixed(1), s: an.bodySeries("vo2", 365), lowerBetter: false },
  ].filter((x) => x.v != null);
  const k = an.kpis();
  const facts = [
    { k: "Completed", v: k.compliance.v != null ? `${k.compliance.v}%` : "-", sub: "Last 28 days" },
    { k: "This Week", v: hm(k.week.h), sub: `of ${hm(k.week.plannedH)} planned` },
    { k: "Fitness", v: k.fitness.v.toFixed(0), sub: k.fitness.d != null ? `${k.fitness.d >= 0 ? "+" : ""}${k.fitness.d.toFixed(1)} this week` : "Training load trend" },
    { k: "Form", v: `${k.form.v > 0 ? "+" : ""}${k.form.v.toFixed(0)}`, sub: k.form.word ? k.form.word.replace(/\b\w/g, (m: string) => m.toUpperCase()) : "Fitness minus fatigue" },
  ];

  // ---------- performance ----------
  const rr = an.raceReadiness();
  const D = athlete.raceDist;
  const longest = [
    { k: "Swim", have: rr.longest.swim, need: D.swimYd, f: (x: number) => swimDist(x).v.toLocaleString(), u: swimDist(1).u },
    { k: "Bike", have: rr.longest.bike, need: D.bikeMi, f: (x: number) => dist(x).v.toFixed(0), u: dist(1).u },
    { k: "Run", have: rr.longest.run, need: D.runMi, f: (x: number) => dist(x).v.toFixed(1), u: dist(1).u },
  ].filter((x) => x.need > 0);
  const tile = (W + 32 - 8) / 2 - 24;

  return (
    <ScrollView contentContainerStyle={st.page} showsVerticalScrollIndicator={false}>
      {/* sport scores */}
      <View style={st.scores}>
        {SPORTS.map(({ k: s, label }) => {
          const on = s === sp, v = score(s)?.score ?? null;
          return (
            <Pressable key={s} onPress={() => setSp(s)} style={[st.score, { backgroundColor: c.surface, borderColor: on ? c.accent : c.line, borderWidth: on ? 1.5 : StyleSheet.hairlineWidth }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Gauge score={v} size={66} color={on ? c.accent : c.ink2} track={c.surface2} ink={c.ink} />
              <View style={st.scoreLab}><SportIcon sport={s} size={13} color={on ? c.accent : c.ink2} /><Text style={[st.scoreName, { color: on ? c.accent : c.ink2 }]}>{label}</Text></View>
            </Pressable>
          );
        })}
      </View>

      <Card title={`${SPORTS.find((x) => x.k === sp)!.label} Analysis`} c={c} right={sc ? <Text style={[st.muted, { color: c.muted }]}>Last 5 vs 5 before</Text> : undefined}>
        <View style={st.statRow}>
          {rowsOut.map((r) => (
            <View key={r.k} style={{ flex: 1 }}>
              <Text style={[st.k, { color: c.muted }]} numberOfLines={1}>{r.k}</Text>
              <Text style={[st.statV, { color: c.ink }]} numberOfLines={1}>{r.val.v}<Text style={[st.u, { color: c.muted }]}> {r.val.u}</Text></Text>
              <Delta pct={r.pct} better={r.better} c={c} />
            </View>
          ))}
        </View>
        <Text style={[st.summary, { color: c.ink2 }]}>{summary}</Text>
        {sc && <Text style={[st.muted, { color: c.muted }]}>Last score {sc.score}: {sc.parts.map((p) => `${p.k} ${p.pts} of ${p.max}`).join(", ")}</Text>}
        <Text style={[st.chartTitle, { color: c.ink }]}>{sp === "bike" ? "Speed" : "Pace"}, Last {pace.length} Sessions</Text>
        <LineChart values={pace.map((p) => p.v)} width={W} color={c.accent} lowerIsBetter={sp !== "bike"} fmt={(v) => paceText(sp, v).v} c={c} />
        <Text style={[st.chartTitle, { color: c.ink }]}>Distance per Week</Text>
        <Bars values={distWeek} labels={weeks12.map((w) => `${w.getDate()}/${w.getMonth() + 1}`)} width={W} color={c.accent} fmt={(v) => `${distText(sp, v).v} ${distText(sp, v).u}`} c={c} />
      </Card>

      {/* volume */}
      <Card title="Weekly Volume" c={c} right={<RangePills options={[{ k: "4", label: "4W" }, { k: "12", label: "12W" }, { k: "26", label: "6M" }, { k: "all", label: "All" }]} value={range} onChange={setRange} />}>
        <View style={st.volNums}>
          <View><Text style={[st.big, { color: c.ink }]}>{hm(volDone[volDone.length - 1] ?? 0)}</Text><Text style={[st.k, { color: c.muted }]}>This Week</Text></View>
          <View><Text style={[st.big, { color: c.ink }]}>{hm(avg)}</Text><Text style={[st.k, { color: c.muted }]}>Weekly Average</Text></View>
        </View>
        <View style={{ height: VH, flexDirection: "row", alignItems: "flex-end" }}>
          {vol.map((w, i) => {
            const y = (h: number) => (h / volTop) * (VH - 6);
            return (
              <View key={w.week} style={{ width: slot, alignItems: "center", justifyContent: "flex-end", height: VH }}>
                <View style={{ position: "absolute", bottom: 0, width: bw, height: y(w.plannedH), borderRadius: 3, backgroundColor: c.surface2 }} />
                <View style={{ width: bw, borderRadius: 3, overflow: "hidden" }}>
                  {([["run", c.run], ["bike", c.bike], ["swim", c.swim], ["other", c.muted]] as const).map(([s, col]) => <View key={s} style={{ height: y(w.actual[s]), backgroundColor: col }} />)}
                </View>
              </View>
            );
          })}
        </View>
        <View style={st.legend}>
          {([["Swim", c.swim], ["Bike", c.bike], ["Run", c.run], ["Planned", c.surface2]] as const).map(([l, col]) => <View key={l} style={st.leg}><View style={[st.legDot, { backgroundColor: col }]} /><Text style={[st.k, { color: c.muted }]}>{l}</Text></View>)}
        </View>
      </Card>

      {/* body and key facts */}
      <Text style={[st.section, { color: c.ink }]}>Body</Text>
      <View style={st.grid}>
        {body.map((b) => {
          const pct = b.v != null && b.prev ? ((b.v - b.prev) / b.prev) * 100 : null;
          return (
            <View key={b.k} style={[st.tile, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[st.k, { color: c.muted }]}>{b.k}</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={[st.tileV, { color: c.ink }]}>{b.f(b.v as number)}<Text style={[st.u, { color: c.muted }]}>{b.u ? ` ${b.u}` : ""}</Text></Text>
                <Delta pct={pct} better={pct == null ? null : b.lowerBetter ? pct < 0 : pct > 0} c={c} />
              </View>
              <Spark values={b.s.map((x) => x.v)} width={tile} color={c.accent} c={c} />
              <Text style={[st.tiny, { color: c.muted }]}>7-day average</Text>
            </View>
          );
        })}
      </View>
      <Text style={[st.section, { color: c.ink }]}>Key Facts</Text>
      <View style={st.grid}>
        {facts.map((f) => (
          <View key={f.k} style={[st.tile, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[st.k, { color: c.muted }]}>{f.k}</Text>
            <Text style={[st.tileV, { color: c.ink }]}>{f.v}</Text>
            <Text style={[st.tiny, { color: c.muted }]}>{f.sub}</Text>
          </View>
        ))}
      </View>

      {/* performance */}
      {athlete.hasRace && (
        <Card title="Performance" c={c} right={<Text style={[st.muted, { color: c.muted }]}>{athlete.race.name}</Text>}>
          {rr.total != null ? (
            <View style={st.volNums}>
              <View><Text style={[st.big, { color: c.ink }]}>{hmm(rr.total)}</Text><Text style={[st.k, { color: c.muted }]}>Projected Finish</Text></View>
              {rr.goalTotal != null && <View><Text style={[st.big, { color: c.ink }]}>{hmm(rr.goalTotal)}</Text><Text style={[st.k, { color: c.muted }]}>Goal</Text></View>}
              {rr.gapMin != null && <View><Text style={[st.big, { color: rr.gapMin <= 0 ? c.ok : c.danger }]}>{Math.abs(Math.round(rr.gapMin))} min</Text><Text style={[st.k, { color: c.muted }]}>{rr.gapMin <= 0 ? "Ahead" : "Behind"}</Text></View>}
            </View>
          ) : (
            <Text style={[st.summary, { color: c.ink2 }]}>A projection shows once your long sessions reach half the race distance.</Text>
          )}
          <Text style={[st.chartTitle, { color: c.ink }]}>Longest Session vs Race Distance</Text>
          {longest.map((l) => (
            <View key={l.k} style={{ gap: 5, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[st.k, { color: c.ink2, fontWeight: "600" }]}>{l.k}</Text>
                <Text style={[st.k, { color: c.muted }]}>{l.f(l.have)} of {l.f(l.need)} {l.u}</Text>
              </View>
              <View style={[st.track, { backgroundColor: c.surface2 }]}><View style={{ width: `${Math.min(100, (l.have / l.need) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: l.k === "Swim" ? c.swim : l.k === "Bike" ? c.bike : c.run }} /></View>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, paddingBottom: 120, gap: 12 },
  scores: { flexDirection: "row", gap: 8 },
  score: { flex: 1, alignItems: "center", paddingTop: 12, paddingBottom: 10, borderRadius: 14, gap: 4 },
  scoreLab: { flexDirection: "row", alignItems: "center", gap: 5 },
  scoreName: { fontSize: 13, fontWeight: "600" },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h2: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  section: { fontSize: 17, fontWeight: "700", letterSpacing: -0.2, marginTop: 6 },
  muted: { fontSize: 12 },
  statRow: { flexDirection: "row", gap: 8 },
  k: { fontSize: 11 },
  statV: { fontSize: 16, fontWeight: "700", marginTop: 2 },
  u: { fontSize: 10, fontWeight: "500" },
  delta: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  summary: { fontSize: 14, lineHeight: 20 },
  chartTitle: { fontSize: 13, fontWeight: "600", marginTop: 6 },
  volNums: { flexDirection: "row", gap: 28 },
  big: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  legend: { flexDirection: "row", gap: 14, justifyContent: "center" },
  leg: { flexDirection: "row", alignItems: "center", gap: 5 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: "48.8%", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  tileV: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  tiny: { fontSize: 11 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
});
