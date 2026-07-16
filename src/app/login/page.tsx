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

const teal = "#008080";
const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", padding: 20 },
  card: { width: "100%", maxWidth: 380, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "32px 28px", boxShadow: "0 10px 30px rgba(0,0,0,.06)" },
  logo: { width: 56, height: 56, objectFit: "contain", display: "block", marginBottom: 10 },
  brand: { fontSize: 28, fontWeight: 800, color: teal, letterSpacing: -0.5 },
  sub: { margin: "4px 0 20px", color: "#6b7280", fontSize: 14 },
  oauth: { width: "100%", display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "10px 14px", marginBottom: 10, border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  oauthIcon: { fontWeight: 800, color: teal },
  divider: { display: "flex", alignItems: "center", gap: 10, margin: "16px 0" },
  dividerLine: { flex: 1, height: 1, background: "#e5e7eb" },
  dividerText: { fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14, fontFamily: "inherit" },
  primary: { padding: "11px 14px", border: "none", borderRadius: 10, background: teal, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  switch: { textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 18 },
  forgot: { textAlign: "center", marginTop: 12 },
  link: { border: "none", background: "none", color: teal, fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  error: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom