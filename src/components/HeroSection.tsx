"use client";

export default function HeroSection() {
  return (
    <section className="grid-bg py-16 md:py-24 text-center px-4">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs mb-8"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
        <span className="w-2 h-2 rounded-full pulse-dot" style={{ backgroundColor: "var(--accent)" }} />
        LIVE DATA
      </div>

      <h1 className="text-4xl md:text-6xl font-bold mb-4">
        <span style={{ color: "var(--accent)" }}>Intelligence</span>{" "}
        <span style={{ color: "var(--text)" }}>Trade</span>
      </h1>

      <p className="text-lg mb-3" style={{ color: "var(--text-dim)" }}>
        Tracking the means of intelligence production
      </p>

      <p className="text-sm max-w-2xl mx-auto font-mono" style={{ color: "var(--text-dim)" }}>
        Control over AI production infrastructure determines 21st-century power dynamics
      </p>
    </section>
  );
}
