// Google's own Google Calendar product icon (public/brand/google-calendar.png, the unmodified 96 px file from
// gstatic.com). Google's brand rules: use it only to mark Google Calendar's own controls (its row in Profile,
// connecting it), never altered, never on its own as decoration.
export function GoogleCalendarIcon({ size = 18 }: { size?: number }) {
  return <img src="/brand/google-calendar.png" width={size} height={size} alt="" aria-hidden="true" style={{ flex: "0 0 auto", display: "block" }} />;
}
