// Server only. One way to use an Outlook or Apple account, whatever the provider: sign in with what is stored,
// make or find the Velocity training calendar, write the plan into it, list calendars and read events.
import { seal, unseal } from "./google";
import type { RawEvent } from "./events";
import type { Writer } from "./engine";
import { CalError } from "./engine";
import { outlookCalendarExists, outlookCreateCalendar, outlookDeleteCalendar, outlookListCalendars, outlookListEvents, outlookRefresh, outlookWriter } from "./outlook";
import { appleCalendarExists, appleCreateCalendar, appleDeleteCalendar, appleListCalendars, appleListEvents, appleWriter, type AppleLogin } from "./apple";
import type { AccountRow } from "./server";

export interface OpenAccount {
  createCalendar(): Promise<string>;
  calendarExists(id: string): Promise<boolean>;
  deleteCalendar(id: string): Promise<void>;
  writer(calendarId: string, tz: string, appUrl: string): Writer;
  listCalendars(ownId: string | null): Promise<{ id: string; name: string; color: string | null; primary: boolean }[]>;
  listEvents(calendarId: string, timeMin: string, timeMax: string): Promise<RawEvent[]>;
  /** Microsoft sends a new refresh token on each use: the encrypted value to store instead of the old one. */
  newSecret: string | null;
}

/** Apple: the stored secret holds the Apple ID and the app-specific password together. */
export const sealApple = (login: AppleLogin) => seal(JSON.stringify({ u: login.user, p: login.pass }));
const unsealApple = (secret: string): AppleLogin => { const o = JSON.parse(unseal(secret)) as { u: string; p: string }; return { user: o.u, pass: o.p }; };

export async function openAccount(row: Pick<AccountRow, "provider" | "secret" | "home">): Promise<OpenAccount> {
  if (!row.secret) throw new CalError(401, "auth", "Not connected.");
  if (row.provider === "outlook") {
    const old = unseal(row.secret);
    const t = await outlookRefresh(old);
    return {
      createCalendar: () => outlookCreateCalendar(t.access),
      calendarExists: (id) => outlookCalendarExists(t.access, id),
      deleteCalendar: (id) => outlookDeleteCalendar(t.access, id),
      writer: (id, tz, appUrl) => outlookWriter(t.access, id, tz, appUrl),
      listCalendars: (own) => outlookListCalendars(t.access, own),
      listEvents: (id, a, b) => outlookListEvents(t.access, id, a, b),
      newSecret: t.refresh !== old ? seal(t.refresh) : null,
    };
  }
  const login = unsealApple(row.secret);
  const home = row.home ?? "";
  return {
    createCalendar: () => appleCreateCalendar(login, home),
    calendarExists: (id) => appleCalendarExists(login, id),
    deleteCalendar: (id) => appleDeleteCalendar(login, id),
    writer: (id, tz, appUrl) => appleWriter(login, id, tz, appUrl),
    listCalendars: (own) => appleListCalendars(login, home, own),
    listEvents: (id, a, b) => appleListEvents(login, id, a, b),
    newSecret: null,
  };
}

/** What the athlete reads when an account stops working. */
export function lostMessage(provider: AccountRow["provider"], e: unknown) {
  const name = provider === "outlook" ? "Outlook" : "Apple Calendar";
  if (e instanceof CalError && (e.status === 401 || /invalid_grant|interaction_required|auth/i.test(e.reason))) {
    return provider === "apple" ? "Apple did not accept the app-specific password any more. Connect again with a new one." : `${name} access was removed. Connect again.`;
  }
  return null;
}
