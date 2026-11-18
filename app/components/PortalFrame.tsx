// Browser-chrome frame for portal visuals. With no `src` it renders the
// placeholder ("Portal demo" plus a muted caption). To swap in a real capture,
// pass `src` (and optionally `alt`) at the call site: a one-line change.
export default function PortalFrame({
  caption,
  src,
  alt = "",
  path = "portal.suppvis.health",
}: {
  caption: string;
  src?: string;
  alt?: string;
  path?: string;
}) {
  return (
    <figure className="rounded-3xl bg-bg-secondary border border-white/[0.06] overflow-hidden shadow-2xl shadow-black/30">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-bg-primary/40">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
        </div>
        <div className="flex-1 max-w-[320px] mx-auto rounded-full bg-white/[0.04] border border-white/[0.05] px-3 py-1 text-center text-[11px] text-text-muted truncate">
          {path}
        </div>
        <div className="w-[42px]" aria-hidden="true" />
      </div>

      {src ? (
        <img src={src} alt={alt} className="block w-full h-auto" />
      ) : (
        <div className="relative aspect-[16/10] flex flex-col items-center justify-center gap-2 px-6 text-center">
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(20,184,166,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(20,184,166,0.5) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <span className="relative font-headline font-bold text-lg text-text-secondary">
            Portal demo
          </span>
          <figcaption className="relative text-sm text-text-muted max-w-[360px]">
            {caption}
          </figcaption>
        </div>
      )}
      {src && <figcaption className="sr-only">{caption}</figcaption>}
    </figure>
  );
}
