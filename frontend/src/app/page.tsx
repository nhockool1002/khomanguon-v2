export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-xs font-mono uppercase tracking-widest text-[#1d3557]">
        Phase 1 — Auth &amp; RBAC
      </p>
      <h1 className="max-w-md text-2xl font-semibold text-zinc-900">
        v2 đang được xây dựng
      </h1>
      <p className="max-w-sm text-sm text-zinc-500">
        Xem tiến độ &amp; kế hoạch triển khai trong{" "}
        <code className="rounded bg-zinc-100 px-1.5 py-0.5">PLAN.md</code> ở
        gốc repo.
      </p>
    </main>
  );
}
