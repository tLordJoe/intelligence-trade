"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Stack" },
  { href: "/congress", label: "Congress" },
  { href: "/blog", label: "Briefing" },
  { href: "/learn", label: "Learn" },
  { href: "/portfolio", label: "Watchlist" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 md:px-8 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Outfox home">
          <Image
            src="/brand/outfox-tail.svg"
            alt=""
            width={42}
            height={36}
            priority
            className="h-9 w-auto md:h-10"
          />
          <span
            className="text-2xl font-extrabold leading-none tracking-tight md:text-[27px]"
            style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
          >
            outfox
          </span>
        </Link>

        <nav className="flex items-center gap-0.5 md:gap-1 overflow-x-auto scrollbar-hide">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-2.5 md:px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
              style={{
                backgroundColor: isActive(link.href) ? "var(--accent-soft)" : "transparent",
                color: isActive(link.href) ? "var(--accent)" : "var(--text-dim)",
              }}
            >
              {link.label}
            </Link>
          ))}
          <button
            onClick={toggleTheme}
            className="ml-1 md:ml-2 w-8 h-8 rounded-full flex items-center justify-center border transition-colors shrink-0"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? "☀" : "☽"}
          </button>
        </nav>
      </div>
    </header>
  );
}
