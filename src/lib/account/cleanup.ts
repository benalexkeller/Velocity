// Before an account is deleted: remove what Velocity created outside (the "Velocity training" calendar in Google,
// Outlook and iCloud, Velocity's access to Google, the Garmin connection at Junction). Used by Delete my account and
// by the Admin page.
// Failures are logged and never stop the deletion.
import { accessFrom, deleteCalendar, revoke, unseal } from "@/lib/calendar/google";
import { openAccount } from "@/lib/calendar/accounts";
import type { CalProvider } from "@/lib/calendar/events";
import { GARMIN_ON } from "@/lib/integrations/config";
import { disconnectGarmin } from "@/lib/integrations/junction";

export interface OutsideLinks {
  googleToken?: string | null; calendarId?: string | null; garminId?: string | null;
  /** Outlook and Apple accounts (calendar_accounts) */
  accounts?: { provider: CalProvider; secret: string | null; calendar_id: string | null; home: string | null }[] | null;
}

export async function cleanupOutside(links: OutsideLinks, tag: string) {
  if (links.googleToken) {
    try {
      const refresh = unseal(String(links.googleToken));
      if (links.calendarId) { try { await deleteCalendar(await accessFrom(refresh), String(links.calendarId)); } catch (e) { console.error(`[${tag}] calendar`, e); } }
      await revoke(refresh);
    } catch (e) { console.error(`[${tag}] google`, e); }
  }
  for (const a of links.accounts ?? []) {
    if (!a.secret || !a.calendar_id) continue;
    try { await (await openAccount(a)).deleteCalendar(a.calendar_id); } catch (e) { console.error(`[${tag}] ${a.provider}`, e); }
  }
  if (GARMIN_ON && links.garminId) {
    try { await disconnectGarmin(String(links.garminId)); } catch (e) { console.error(`[${tag}] garmin`, e); }
  }
}
