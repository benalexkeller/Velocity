// The mark shown to the left of each wearable in the Connect sheet and in Profile. A maker's own logo is used only
// when its file is in public/brand/ (downloaded unchanged from the maker's brand or developer page by PR, under that
// maker's rules, then only cropped to its edges and scaled) and listed in BRAND_FILES; every other maker gets a plain
// watch or band outline. Nothing is drawn to look like a maker's logo. Apple Watch stays as its name: Apple does not
// license its logo to third-party apps.
import type { WearableKey } from "@/lib/wearables/providers";

/** Official files present in public/brand/, by maker. Add a line here when PR adds the file. */
export const BRAND_FILES: Partial<Record<WearableKey, string>> = {
  garmin: "garmin.png",
  whoop: "whoop.png",
  coros: "coros.png",
  polar: "polar.png",
  fitbit: "fitbit.png",
};

/** A plain watch outline (Apple Watch, Suunto, Wahoo) or a band outline (WHOOP). */
function Glyph({ kind }: { kind: "watch" | "band" }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {kind === "band"
        ? <><rect x="7" y="2.5" width="10" height="19" rx="5" /><rect x="9.5" y="8" width="5" height="8" rx="2" /></>
        : <><circle cx="12" cy="12" r="5.6" /><path d="M9 3h6l.8 3.4M9 3l-.8 3.4M9 21h6l.8-3.4M9 21l-.8-3.4M12 9.5V12l1.6 1" /></>}
    </svg>
  );
}

/** `size` is the row height; the box is 3× as wide so a wordmark fits, and every mark sits on white. */
export function BrandMark({ k, size = 36 }: { k: WearableKey; size?: number }) {
  const file = BRAND_FILES[k];
  return (
    <span className="brand-mark" style={{ width: size * 3, height: size }}>
      {file ? <img src={`/brand/${file}`} height={Math.round(size * 0.5)} alt="" aria-hidden="true" /> : <Glyph kind={k === "whoop" ? "band" : "watch"} />}
    </span>
  );
}
