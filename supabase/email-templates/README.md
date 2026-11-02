# Velocity emails (Supabase Auth)

Paste each file into Supabase → Authentication → Emails → Templates, with its subject. The links go straight to
`/auth/callback?token_hash=…&type=…`, which signs the athlete in on the server (`verifyOtp`) and continues to the page
in `next`. Unlike Supabase's default `{{ .ConfirmationURL }}` links, they work in any browser and on any device.

| Template in Supabase | File | Subject |
| --- | --- | --- |
| Reset password | reset-password.html | Reset your Velocity password |
| Confirm sign up | confirm-signup.html | Confirm your email for Velocity |
| Magic link | magic-link.html | Your Velocity sign-in link |
| Change email address | change-email.html | Confirm your new email for Velocity |
| Invite user | invite.html | You are invited to Velocity |

Needs: Supabase → Authentication → URL Configuration → Site URL = https://www.velocityathletes.com (`{{ .SiteURL }}`),
and an email sender (Authentication → Emails → SMTP Settings): Resend, host smtp.resend.com, port 465, username
`resend`, password = a Resend API key, sender no-reply@velocityathletes.com, sender name Velocity. Without a custom
sender, Supabase only delivers to the project team's own addresses, two emails an hour.
