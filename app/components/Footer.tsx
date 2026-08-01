export default function Footer() {
  return (
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
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="/how-it-works" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="/shop" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Shop
                </a>
              </li>
              <li>
                <a href="/blog" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Blog
                </a>
              </li>
              <li>
                <a href="/research" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Research
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="/about" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="/partnerships" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Partnerships
                </a>
              </li>
            </ul>
            <h4 className="text-sm font-semibold text-text-primary mb-4 mt-8">
              Legal
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a href="/privacy" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Terms of Use
                </a>
              </li>
              <li>
                <a href="/affiliate-disclosure" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Affiliate Disclosure
                </a>
              </li>
              <li>
                <a href="/medical-disclaimer" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Medical Disclaimer
                </a>
              </li>
              <li>
                <a href="/sources" className="text-sm text-text-muted hover:text-text-secondary transition-colors">
                  Sources
                </a>
              </li>
            </ul>
          </div>

          {/* Subscribe */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-4">
              Newsletter
            </h4>
            <p className="text-sm text-text-muted leading-relaxed">
              Newsletter under construction. Join the beta above for current
              SuppVis updates.
            </p>
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
          <p className="text-xs text-text-muted/60 text-center mt-2 leading-relaxed">
            As an Amazon Associate, SuppVis earns from qualifying purchases.
          </p>
        </div>
      </div>
    </footer>
  );
}
