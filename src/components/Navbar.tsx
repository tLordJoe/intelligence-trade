"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
function readDarkTheme() { return document.documentElement.classList.contains("dark"); }
function serverDarkTheme() { return false; }

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/congress", label: "Congress" },
  { href: "/blog", label: "Briefing" },
  { href: "/learn", label: "Learn" },
  { href: "/portfolio", label: "Watchlist" },
  { href: "/about", label: "About" },
];

export default function Navbar({ showCompare = false }: { showCompare?: boolean }) {
  const pathname = usePathname();
  const dark = useSyncExternalStore(subscribeToTheme, readDarkTheme, serverDarkTheme);
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleTheme() {
    const next = !readDarkTheme();
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/explore") return ["/explore", "/sectors", "/stocks", "/etfs"].some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
    return pathname.startsWith(href);
  }

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: "var(--bg-header)",
        borderColor: "var(--border)",
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-3">
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

        <button type="button" className="md:hidden border rounded-lg px-3 min-h-11 text-sm font-semibold" style={{ borderColor: "var(--border)" }} aria-expanded={menuOpen} aria-controls="outfox-primary-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close" : "Menu"}</button>
        <nav id="outfox-primary-nav" aria-label="Primary" className={`${menuOpen ? "flex" : "hidden"} md:flex flex-wrap items-center gap-1 w-full md:w-auto`}>
          {NAV_LINKS.flatMap((link) => link.href === "/explore" && showCompare
            ? [link, { href: "/compare", label: "Compare · Preview" }] : [link]).map((link) => (
            <Link
              key={link.href}
              onClick={() => setMenuOpen(false)}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className="px-2.5 md:px-3 py-1.5 min-h-11 inline-flex items-center rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
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
            className="ml-1 md:ml-2 w-11 h-11 rounded-full flex items-center justify-center border transition-colors shrink-0"
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
