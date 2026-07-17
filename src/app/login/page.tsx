"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signIn, signUp } from "./actions";

type Provider = "google" | "azure";
type Mode = "signin" | "signup" | "forgot";

function LoginInner() {
  const sp = useSearchParams();
  const initialMode = sp.get("mode") === "signup" ? "signup" : "signin";
  const [mode, setMode] = useState<Mode>(initialMode);
  const error = sp.get("error");
  const notice = sp.get("notice");

  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);

  function siteUrl() {
    return (
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "")
    );
  }

  async function oauth(provider: Provider) {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${siteUrl()}/auth/callback` },
    });
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setResetMsg(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${siteUrl()}/auth/callback?next=/reset`,
    });
    setBusy(false);
    // Always show the same confirmation (don't reveal whether an account exists).
    setResetMsg(
      error && !/rate|limit/i.test(error.message)
        ? error.message
        : "If that email has an account, a reset link is on its way from SellHi."
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <img src="/favicon-512.png" alt="SellHi" style={styles.logo} />
        <div style={styles.brand}>SellHi</div>
        <p style={styles.sub}>
          {mode === "signin"
            ? "Sign in to your workspace"
            : mode === "signup"
            ? "Create your workspace"
            : "Reset your password"}
        </p>

        {error && <div style={styles.error}>{error}</div>}
        {notice && <div style={styles.notice}>{notice}</div>}

        {mode === "forgot" ? (
          <>
            {resetMsg && <div style={styles.notice}>{resetMsg}</div>}
            <form onSubmit={sendReset} style={styles.form}>
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                style={styles.input}
              />
              <button type="submit" style={styles.primary} disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p style={styles.switch}>
              <button style={styles.link} onClick={() => { setMode("signin"); setResetMsg(null); }}>
                ← Back to sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <button style={styles.oauth} onClick={() => oauth("google")}>
              <span style={styles.oauthIcon}>G</span> Continue with Google
            </button>
            <button style={styles.oauth} onClick={() => oauth("azure")}>
              <span style={styles.oauthIcon}>⊞</span> Continue with Microsoft
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or with email</span>
              <span style={styles.dividerLine} />
            </div>

            <form action={mode === "signin" ? signIn : signUp} style={styles.form}>
              {mode === "signup" && (
                <>
                  <input name="fullName" placeholder="Full name" required style={styles.input} />
                  <input name="title" placeholder="Title (e.g. Fractional CXO)" defaultValue="Fractional CXO" style={styles.input} />
                  <input name="company" placeholder="Company (optional)" style={styles.input} />
                </>
              )}
              <input name="email" type="email" placeholder="Email" required style={styles.input} />
              <input name="password" type="password" placeholder="Password" required minLength={8} style={styles.input} />
              <button type="submit" style={styles.primary}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            {mode === "signin" && (
              <p style={styles.forgot}>
                <button style={styles.link} onClick={() => { setMode("forgot"); setResetMsg(null); }}>
                  Forgot password?
                </button>
              </p>
            )}

            <p style={styles.switch}>
              {mode === "signin" ? (
                <>New here?{" "}
                  <button style={styles.link} onClick={() => setMode("signup")}>Create an account</button>
                </>
              ) : (
                <>Already have an account?{" "}
                  <button style={styles.link} onClick={() => setMode("signin")}>Sign in</button>
                </>
              )}
            </p>
          </>
        )}

        <p style={styles.legal}>
          By continuing you agree to our{" "}
          <button type="button" style={styles.legalLink} onClick={() => setLegal("terms")}>Terms</button>{" "}&amp;{" "}
          <button type="button" style={styles.legalLink} onClick={() => setLegal("privacy")}>Privacy</button>.
        </p>

        {legal && (
          <div style={styles.legalOverlay} onClick={() => setLegal(null)}>
            <div style={styles.legalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.legalHead}>
                <strong>{legal === "terms" ? "Terms of Service" : "Privacy Policy"}</strong>
                <button type="button" style={styles.legalClose} onClick={() => setLegal(null)} aria-label="Close">×</button>
              </div>
              <div style={styles.legalBody}>{legal === "terms" ? TERMS : PRIVACY}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

const TERMS = `DRAFT — pending legal review. This is placeholder text, not the final agreement.

These Terms of Service ("Terms") govern your access to and use of SellHi, a product of AxIncha Inc. ("we", "us", "our"). By creating an account or using the service, you agree to these Terms.

1. Your account. You are responsible for activity on your account and for keeping your login credentials secure.

2. Acceptable use. You agree not to misuse the service, attempt to disrupt or reverse-engineer it, or use it to violate any law or the rights of others.

3. Your content and data. You retain ownership of the content and data you add. You grant us the limited rights needed to operate, secure, and improve the service for you.

4. Connected services. When you connect third-party tools (such as Google or Microsoft calendars), your use of those services is also governed by their own terms.

5. Availability. During this early-ac