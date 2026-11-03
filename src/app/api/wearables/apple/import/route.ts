// POST /api/wearables/apple/import { workouts, days, device } — the Velocity iPhone app sends what Apple Health
// holds (workouts from the Apple Watch, resting heart rate, HRV, sleep, VO2max). Signed in as the athlete, so their
// own session does the writing. At most 200 workouts and 400 days per call; the app sends the rest in later calls.
import { NextResponse, type NextRequest } from "next/server";
import { athlete } from "@/lib/calendar/server";
import { appleDay, appleWorkout, type ApplePayload } from "@/lib/wearables/apple";
import { markConnection, saveBodyDays, saveWorkouts } from "@/lib/wearables/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const me = await athlete();
  if (!me) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as ApplePayload | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const workouts = (Array.isArray(body.workouts) ? body.workouts : []).slice(0, 200).map(appleWorkout).filter((w): w is NonNullable<typeof w> => !!w);
  const days = (Array.isArray(body.days) ? body.days : []).slice(0, 400).map(appleDay).filter((d): d is NonNullable<typeof d> => !!d);
  try {
    const saved = await saveWorkouts(me.sb, me.uid, "apple", workouts);
    const bodyDays = await saveBodyDays(me.sb, me.uid, "apple", days);
    const now = new Date().toISOString();
    const { data: had } = await me.sb.from("integrations").select("connected_at").eq("user_id", me.uid).eq("provider", "apple").maybeSingle();
    await markConnection(me.sb, me.uid, "apple", "app", {
      status: "connected", last_event_at: now, synced_at: now, error: null, ...(had?.connected_at ? {} : { connected_at: now }),
      ...(typeof body.device === "string" && body.device.trim() ? { device: body.device.trim().slice(0, 60) } : {}),
    });
    return NextResponse.json({ ok: true, workouts: saved, bodyDays });
  } catch (e) {
    console.error("[wearables/apple/import]", e);
    return NextResponse.json({ error: "Did not save. Try again." }, { status: 500 });
  }
}
