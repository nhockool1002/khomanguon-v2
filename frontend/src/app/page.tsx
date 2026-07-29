export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-[#16181d] px-6 py-4 text-white">
        <span className="text-sm font-semibold uppercase tracking-wide">
          khomanguon.vn
        </span>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-xs font-mono uppercase tracking-widest text-[#1d3557]">
          Phase 0 — nền tảng dự án
        </p>
        <h1 className="max-w-md text-2xl font-semibold text-zinc-900">
          v2 đang được xây dựng
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          Xem tiến độ &amp; kế hoạch triển khai trong{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5">PLAN.md</code>{" "}
          ở gốc repo.
        </p>
      </main>
    </div>
  );
}
