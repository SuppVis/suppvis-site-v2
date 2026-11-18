import BoundaryStatement from "./components/BoundaryStatement";

export default function NotFound() {
  return (
    <>
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="font-headline font-bold text-6xl text-text-primary mb-4">404</h1>
        <p className="text-text-secondary text-lg mb-8">This page could not be found.</p>
        <a
          href="/"
          className="inline-flex items-center px-6 py-3 rounded-full bg-accent text-bg-primary font-semibold hover:bg-accent-hover transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
    <BoundaryStatement />
    </>
  );
}
