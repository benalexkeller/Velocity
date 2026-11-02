// Microsoft's own "Sign in with Microsoft" button (public/brand/ms-signin-light.svg, the unmodified light-theme file
// from learn.microsoft.com, Entra ID, "Sign in with Microsoft: Branding guidelines for applications"). Microsoft's
// rules: the logo is never altered, the button leads straight to Microsoft's sign-in, and "work or school account"
// is the wording to use next to it. Outlook's own app icon may not be used (Microsoft trademark guidelines).
export function MicrosoftSignInButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="ms-signin" onClick={onClick} disabled={disabled}>
      <img src="/brand/ms-signin-light.svg" width={215} height={41} alt="Sign in with Microsoft" />
    </button>
  );
}
