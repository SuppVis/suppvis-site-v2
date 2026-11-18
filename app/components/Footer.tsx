import BoundaryStatement from "./BoundaryStatement";

const linkClass = "text-sm text-text-muted hover:text-text-secondary transition-colors";

const PRODUCT_LINKS = [
  { href: "/", label: "For practices" },
  { href: "/portal", label: "Portal" },
  { href: "/patients", label: "For patients" },
  { href: "/research", label: "Research" },
  { href: "/sources", label: "Sources" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/affiliate-disclosure", label: "Affiliate Disclosure" },
  { href: "/medical-disclaimer", label: "Medical Disclaimer" },
];

export default function Footer() {
  return (
    <>
      <BoundaryStatement />
      <footer className="border-t border-white/5 bg-bg-secondary">
        <div className="max-w-[1200px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div>
              <span className="font-headline font-bold text-xl text-text-primary">
                SuppVis
              </span>
              <p className="mt-3 text-sm text-text-muted leading-relaxed">
                Clarity over complexity.
                <br />
                Science over hype.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-4">Product</h4>
              <ul className="space-y-2.5">
                {PRODUCT_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className={linkClass}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="/about" className={linkClass}>About</a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {LEGAL_LINKS.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className={linkClass}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5">
          <div className="max-w-[1200px] mx-auto px-6 py-6">
            <p className="text-xs text-text-muted text-center leading-relaxed">
              &copy; 2026 SuppVis. All rights reserved. Not medical advice. Always
              consult your healthcare provider.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
