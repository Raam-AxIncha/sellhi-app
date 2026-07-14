# SellHi branded email templates

Paste these into **Supabase → Authentication → Emails → Templates**. For each template:
1. Pick the template tab (Confirm signup / Reset password / Magic Link).
2. Set the **Subject** field.
3. Replace the **Message body (HTML)** with the block below.
4. Click **Save**.

Notes:
- The `{{ .ConfirmationURL }}` placeholder is Supabase's — leave it exactly as-is; it becomes the real link.
- Raleway renders in clients that support web fonts (Apple Mail, iOS, most webmail); Outlook falls back to a clean sans-serif. This is normal for email and can't be forced.
- Colours match the app: teal `#008080`, dark teal `#006666`.

---

## 1) Confirm signup

**Subject:** `Confirm your SellHi account`

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;800&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#f9fafb;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">Confirm your email to activate your SellHi workspace.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;font-family:'Raleway','Helvetica Neue',Arial,sans-serif;">
<tr><td style="padding:28px 32px 0 32px;">
<div style="font-size:26px;font-weight:800;color:#008080;letter-spacing:-0.5px;">SellHi</div>
</td></tr>
<tr><td style="padding:18px 32px 0 32px;">
<h1 style="margin:0;font-size:20px;font-weight:800;color:#111827;">Welcome to SellHi</h1>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#4b5563;">You're one click from your workspace. Confirm your email and we'll get to work building your revenue engine.</p>
</td></tr>
<tr><td style="padding:24px 32px 4px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:10px;background:#008080;">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 26px;font-family:'Raleway','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Confirm my email</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0 32px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#008080;word-break:break-all;">{{ .ConfirmationURL }}</a></p>
</td></tr>
<tr><td style="padding:22px 32px 28px 32px;">
<hr style="border:none;border-top:1px solid #eef1f4;margin:0 0 14px 0;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">If you didn't create a SellHi account, you can safely ignore this email.<br>SellHi — Sales-as-a-Service by AxIncha</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
```

---

## 2) Reset password

**Subject:** `Reset your SellHi password`

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;800&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#f9fafb;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">Choose a new SellHi password. Link expires in 60 minutes.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;font-family:'Raleway','Helvetica Neue',Arial,sans-serif;">
<tr><td style="padding:28px 32px 0 32px;">
<div style="font-size:26px;font-weight:800;color:#008080;letter-spacing:-0.5px;">SellHi</div>
</td></tr>
<tr><td style="padding:18px 32px 0 32px;">
<h1 style="margin:0;font-size:20px;font-weight:800;color:#111827;">Reset your password</h1>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#4b5563;">We received a request to reset your SellHi password. Choose a new one below — this link expires in 60 minutes.</p>
</td></tr>
<tr><td style="padding:24px 32px 4px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:10px;background:#008080;">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 26px;font-family:'Raleway','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Set a new password</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0 32px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#008080;word-break:break-all;">{{ .ConfirmationURL }}</a></p>
</td></tr>
<tr><td style="padding:22px 32px 28px 32px;">
<hr style="border:none;border-top:1px solid #eef1f4;margin:0 0 14px 0;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">If you didn't request this, you can safely ignore this email — your password stays the same.<br>SellHi — Sales-as-a-Service by AxIncha</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
```

---

## 3) Magic Link

**Subject:** `Your SellHi sign-in link`

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;800&display=swap');</style>
</head>
<body style="margin:0;padding:0;background:#f9fafb;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">Your secure, one-time SellHi sign-in link.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;font-family:'Raleway','Helvetica Neue',Arial,sans-serif;">
<tr><td style="padding:28px 32px 0 32px;">
<div style="font-size:26px;font-weight:800;color:#008080;letter-spacing:-0.5px;">SellHi</div>
</td></tr>
<tr><td style="padding:18px 32px 0 32px;">
<h1 style="margin:0;font-size:20px;font-weight:800;color:#111827;">Your sign-in link</h1>
<p style="margin:12px 0 0 0;font-size:15px;line-height:1.6;color:#4b5563;">Here's your secure link into SellHi. It can be used once and expires shortly.</p>
</td></tr>
<tr><td style="padding:24px 32px 4px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:10px;background:#008080;">
<a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 26px;font-family:'Raleway','Helvetica Neue',Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Sign in to SellHi</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0 32px;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">Or paste this link into your browser:<br><a href="{{ .ConfirmationURL }}" style="color:#008080;word-break:break-all;">{{ .ConfirmationURL }}</a></p>
</td></tr>
<tr><td style="padding:22px 32px 28px 32px;">
<hr style="border:none;border-top:1px solid #eef1f4;margin:0 0 14px 0;">
<p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">If you didn't request this, you can safely ignore this email.<br>SellHi — Sales-as-a-Service by AxIncha</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
```
