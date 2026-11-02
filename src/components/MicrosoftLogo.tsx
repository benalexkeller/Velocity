// Microsoft's own logo (public/brand/microsoft-logo.svg, the unmodified file "ms-symbollockup_mssymbol_19.svg" from
// learn.microsoft.com, Entra ID, "Sign in with Microsoft: Branding guidelines for applications"). Microsoft offers it
// for apps to show that a Microsoft account is used; its rule is that the logo is never altered. Used only on the
// Outlook row, which signs in with Microsoft. Outlook's own app icon needs a license from Microsoft and is not used.
export function MicrosoftLogo({ size = 18 }: { size?: number }) {
  return <img src="/brand/microsoft-logo.svg" width={size} height={size} alt="" aria-hidden="true" style={{ flex: "0 0 auto", display: "block" }} />;
}
