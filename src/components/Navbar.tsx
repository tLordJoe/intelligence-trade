"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <Link href="/" className="flex items-center gap-2">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="mx-2 opacity-30">|</span>
        <span style={{ color: "var(--accent)" }}>$</span>
        <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>
          intelligence-trade
        </span>
        <span className="typing-cursor opacity-50" />
      </Link>

      <nav className="flex items-center gap-1">
        <Link
          href="/"
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: pathname === "/" ? "var(--accent)" : "transparent",
            color: pathname === "/" ? "#fff" : "var(--text-dim)",
          }}
        >
          stack
        </Link>
        <Link
          href="/congress"
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: pathname === "/congress" ? "var(--accent)" : "transparent",
            color: pathname === "/congress" ? "#fff" : "var(--text-dim)",
          }}
        >
          congress
        </Link>
        <Link
          href="/signals"
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: pathname === "/signals" ? "var(--accent)" : "transparent",
            color: pathname === "/signals" ? "#fff" : "var(--text-dim)",
          }}
        >
          signals
        </Link>
        <Link
          href="/blog"
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: pathname.startsWith("/blog") ? "var(--accent)" : "transparent",
            color: pathname.startsWith("/blog") ? "#fff" : "var(--text-dim)",
          }}
        >
          blog
        </Link>
        <Link
          href="/portfolio"
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{
            backgroundColor: pathname === "/portfolio" ? "var(--accent)" : "transparent",
            color: pathname === "/portfolio" ? "#fff" : "var(--text-dim)",
          }}
        >
          portfolio
        </Link>
        <button
          onClick={toggleTheme}
          className="ml-2 w-8 h-8 rounded-full flex items-center justify-center border transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? "☀" : "☽"}
        </button>
      </nav>
    </header>
  );
}
