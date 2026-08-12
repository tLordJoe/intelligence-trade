"use client";

import { useEffect, useState } from "react";

type Status = "idle" | "checking" | "unavailable" | "submitting" | "done" | "error";

interface Props {
  /** "inline" sits inside a page section; "banner" is the wider hero treatment. */
  variant?: "inline" | "banner";
  heading?: string;
  blurb?: string;
}

export default function NewsletterSignup({
  variant = "inline",
  heading = "The Outfox Report",
  blurb = "One email each Friday: what moved across the AI supply chain, which House members filed trades in those companies, and what it means. Free.",
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");

  // Hide the form entirely if the mailing list isn't wired up yet, rather
  // than showing a control that can't accept an address.
  useEffect(() => {
    let alive = true;
    fetch("/api/subscribe")
      .then((r) => r.json())
      .then((d) => alive && setStatus(d?.enabled ? "idle" : "unavailable"))
      .catch(() => alive && setStatus("unavailable"));
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("done");
        setMessage(
          data.alreadySubscribed
            ? "You're already on the list — see you Friday."
            : "You're in. The next Report lands Friday."
        );
      } else {
        setStatus("error");
        setMessage(data?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't reach the server. Please try again.");
    }
  }

  if (status === "checking" || status === "unavailable") return null;

  const isBanner = variant === "banner";

  return (
    <section className={isBanner ? "px-4 md:px-8 py-8" : "px-4 md:px-8 py-6"}>
      <div
        className="rounded-lg border p-5 md:p-6"
        style={{
          backgroundColor: isBanner ? "var(--bg-inset)" : "var(--bg-card)",
          borderColor: "var(--border)",
        }}
      >
        <div className="kicker mb-1">Weekly briefing</div>
        <h2
          className={`font-bold ${isBanner ? "text-2xl" : "text-xl"}`}
          style={{ color: "var(--text)" }}
        >
          {heading}
        </h2>
        <p className="text-sm mt-2 mb-4 max-w-xl" style={{ color: "var(--text-dim)" }}>
          {blurb}
        </p>

        {status === "done" ? (
          <p className="text-sm font-semibold" style={{ color: "var(--green)" }}>
            {message}
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md">
            <label className="sr-only" htmlFor="newsletter-email">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-10 flex-1 rounded-md border px-3 text-sm"
              style={{
                backgroundColor: "var(--bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
            <button
              type="submit"
              disabled={status === "submitting"}
              className="min-h-10 rounded-md px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {status === "submitting" ? "Subscribing…" : "Get the Report"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="text-xs mt-2" style={{ color: "var(--red)" }} role="alert">
            {message}
          </p>
        )}

        <p className="text-[11px] mt-3" style={{ color: "var(--text-dim)" }}>
          No spam, unsubscribe anytime. Outfox publishes information and
          analysis, not investment advice.
        </p>
      </div>
    </section>
  );
}
