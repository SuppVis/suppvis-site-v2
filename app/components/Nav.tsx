"use client";

import { useState, useEffect } from "react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      {/* Mobile menu backdrop — full-screen so the links sit on solid bg */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 bg-bg-primary/95 backdrop-blur-lg transition-opacity duration-300 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Bar — carries the scrolled blur so <nav> stays free of backdrop-filter */}
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
          <div className="hidden md:flex items-center gap-8">
            <a href="/how-it-works" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              How It Works
            </a>
            <a href="/shop" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Shop
            </a>
            <a href="/blog" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Blog
            </a>
            <a href="/about" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              About
            </a>
            <a
              href="#waitlist"
              className="inline-flex items-center px-5 py-2.5 rounded-full bg-accent text-bg-primary text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Get Early Access
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden relative w-8 h-8 flex items-center justify-center"
            aria-label="Toggle menu"
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
        className={`md:hidden fixed inset-0 top-16 transition-all duration-300 ${
          menuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex flex-col items-center gap-8 pt-12">
          <a
            href="/how-it-works"
            onClick={() => setMenuOpen(false)}
            className="text-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            How It Works
          </a>
          <a
            href="/shop"
            onClick={() => setMenuOpen(false)}
            className="text-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            Shop
          </a>
          <a
            href="/blog"
            onClick={() => setMenuOpen(false)}
            className="text-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            Blog
          </a>
          <a
            href="/about"
            onClick={() => setMenuOpen(false)}
            className="text-lg text-text-secondary hover:text-text-primary transition-colors"
          >
            About
          </a>
          <a
            href="#waitlist"
            onClick={() => setMenuOpen(false)}
            className="inline-flex items-center px-8 py-3 rounded-full bg-accent text-bg-primary text-lg font-semibold hover:bg-accent-hover transition-colors"
          >
            Get Early Access
          </a>
        </div>
      </div>
    </nav>
  );
}
