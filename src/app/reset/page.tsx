"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPage() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The recovery link lands here already signed in (callback exchanged the code).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(!!data.user);
      setReady(true);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (pw.length < 8) return setMsg("Password must be at least 8 characters.");
    if (pw !== pw2) return setMsg("Passwords don't match.");
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg(error.message);
    window.location.href = "/";
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <svg viewBox="0 0 100 100" style={styles.mark} aria-hidden="true">
            <g fill="none" stroke="#178a8a" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17,86 L49,54" />
              <path d="M49,54 L33,54 M49,54 L49,70" />
            </g>
            <g className="shWheel" fill="none" stroke="#F26A21" strokeWidth={6} strokeLinecap="round">
              <circle cx={65} cy={35} r={12.5} />
              <circle cx={65} cy={35} r={4.5} fill="#F26A21" stroke="none" />
              <path d="M65,16.5 L65,7.5 M81,25.8 L88.8,21.3 M81,44.3 L88.8,48.8 M65,53.5 L65,62.5 M49,44.3 L41.2,48.8 M49,25.8 L41.2,21.3" strokeWidth={5} />
            </g>
          </svg>
          <span style={styles.brand}>Sell<sup style={styles.hi} className="shHi">Hi</sup></span>
        </div>
        <style>{`
          @keyframes shWheelSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          .shWheel{transform-box:fill-box;transform-origin:center;animation:shWheelSpin 5.5s linear infinite}
          @keyframes shHiTwinkle{0%,60%,100%{text-shadow:none;transform:scale(1)}74%{text-shadow:0 0 7px #F26A21,0 0 15px rgba(242,106,33,.75);transform:scale(1.1)}88%{text-shadow:none;transform:scale(1)}}
          .shHi{display:inline-block;animation:shHiTwinkle 3.4s ease-in-out infinite}
          @media(prefers-reduced-motion:reduce){.shWheel,.shHi{animation:none}}
        `}</style>
        <p style={styles.sub}>Set a new password</p>

        {!ready ? (
          <p style={styles.dim}>Loading…</p>
        ) : !hasSession ? (
          <>
            <div style={styles.error}>
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </div>
            <p style={styles.switch}>
              <a href="/login" style={styles.link}>← Back to sign in</a>
            </p>
          </>
        ) : (
          <>
            {msg && <div style={styles.error}>{msg}</div>}
            <form onSubmit={submit} style={styles.form}>
              <input
                type="password"
                placeholder="New password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                minLength={8}
                required
                style={styles.input}
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                minLength={8}
                required
                style={styles.input}
              />
              <button type="submit" style={styles.primary} disabled={busy}>
                {busy ? "Saving…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const teal = "#008080";
const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", padding: 20 },
  card: { width: "100%", maxWidth: 380, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "32px 28px", boxShadow: "0 10px 30px rgba(0,0,0,.06)" },
  brandRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  mark: { width: 52, height: 52, overflow: "visible", display: "block" },
  hi: { color: "#F26A21", fontSize: "0.5em", verticalAlign: "super", marginLeft: 1 },
  brand: { fontSize: 28, fontWeight: 800, color: teal, letterSpacing: -0.5 },
  sub: { margin: "4px 0 20px", color: "#6b7280", fontSize: 14 },
  dim: { color: "#9ca3af", fontSize: 14 },
  form: { display: "flex", flexDirection: "column", gap: 10 },
  input: { padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 14, fontFamily: "inherit" },
  primary: { padding: "11px 14px", border: "none", borderRadius: 10, background: teal, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  switch: { textAlign: "center", fontSize: 13, color: "#6b7280", marginTop: 18 },
  link: { border: "none", background: "none", color: teal, fontWeight: 700, cursor: "pointer", fontSize: 13, textDecoration: "none" },
  error: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 14 },
};
