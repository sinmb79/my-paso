import { HomeWorkspace } from "@/components/home/HomeWorkspace";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-950 px-6 py-12 text-stone-50 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <section className="rounded-[2rem] border border-stone-800 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.14),transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-10 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <p className="text-sm uppercase tracking-[0.35em] text-amber-300/80">
            Local-First Phase 0
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-stone-50 sm:text-6xl">
            Hello! My Paso!
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-300 sm:text-lg">
            Dummy POI seed ready for map shell testing. This foundation keeps
            the first run unblocked while public API credentials are still
            pending.
          </p>
        </section>
        <HomeWorkspace />
      </div>
    </main>
  );
}
