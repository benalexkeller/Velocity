// Footer of the public pages: wordmark, the three legal links, one line on data.
import Link from "next/link";
import { BRAND } from "@/lib/config";

export function PublicFooter() {
  return (
    <footer className="lp-foot">
      <div className="lp-foot-row">
        <Link href="/" className="wordmark pn-mark">{BRAND.name}</Link>
        <span className="lp-foot-links"><a href="/help">Help</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></span>
      </div>
      <div className="lp-foot-row lp-foot-note">
        <span>Only you can see your data. It is never used to train models.</span>
      </div>
    </footer>
  );
}
