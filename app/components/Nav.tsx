"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { BOOK_DEMO_HREF } from "../lib/site";

const NAV_LINKS = [
  { href: "/", label: "For practices" },
  { href: "/portal", label: "How the portal works" },
  { href: "/patients", label: "For patients" },
  { href: "/research", label: "Research" },
  { href: "/about", label: "About" },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Mobile menu backdrop: full-screen so the links sit on solid bg */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`lg:hidden fixed inset-0 bg-bg-primary/95 backdrop-blur-lg transition-opacity duration-300 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Bar: carries the scrolled blur so <nav> stays free of backdrop-filter */}
      <div
        className={`relative z-10 transition-all duration-300 ${
          scrolled
            ? "bg-bg-primary/80 backdrop-blur-lg border-b border-white/5"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-[1200px] px-6 flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 font-headline text-xl md:text-2xl font-bold text-accent tracking-tight">
            <img src="/logo-icon.svg" alt="SuppVis logo" className="h-7 w-auto" />
            SuppVis
          </a>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <a
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-sm transition-colors ${
                    active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {l.label}
                </a>
              );
            })}
            <a
              href={BOOK_DEMO_HREF}
              className="inline-flex items-center px-5 py-2.5 rounded-full bg-accent text-bg-primary text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Book a demo
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden relative w-8 h-8 flex items-center justify-center"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span
              className={`absolute h-0.5 w-5 bg-text-primary transition-all duration-300 ${
                menuOpen ? "rotate-45" : "-translate-y-1.5"
              }`}
            />
            <span
              className={`absolute h-0.5 w-5 bg-text-primary transition-all duration-300 ${
                menuOpen ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute h-0.5 w-5 bg-text-primary transition-all duration-300 ${
                menuOpen ? "-rotate-45" : "translate-y-1.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        onClick={() => setMenuOpen(false)}
        className={`lg:hidden fixed inset-0 top-16 md:top-20 transition-all duration-300 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col items-center gap-8 pt-12">
          {NAV_LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <a
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={`text-lg transition-colors ${
                  active ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {l.label}
              </a>
            );
          })}
          <a
            href={BOOK_DEMO_HREF}
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center px-8 py-3 rounded-full bg-accent text-bg-primary text-lg font-semibold hover:bg-accent-hover transition-colors"
          >
            Book a demo
          </a>
        </div>
      </div>
    </nav>
  );
}
