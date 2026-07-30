import Link from "next/link";

// Chip phân trang "‹ 1 2 3 ›" cho trang chủ/danh mục/tìm kiếm (wireframe #02).
export function Pagination({
  baseHref,
  page,
  totalPages,
  extraQuery,
}: {
  baseHref: string;
  page: number;
  totalPages: number;
  // Giữ lại các tham số khác (q, sort...) khi chuyển trang.
  extraQuery?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraQuery ?? {})) {
      if (value) params.set(key, value);
    }
    params.set("page", String(p));
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <nav className="flex items-center justify-center gap-1.5 py-6 font-mono text-sm">
      <PageLink href={buildHref(Math.max(page - 1, 1))} disabled={page <= 1}>
        ‹
      </PageLink>
      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          className={`rounded-md px-2.5 py-1 ${
            p === page
              ? "bg-[#1d3557] text-white"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {p}
        </Link>
      ))}
      <PageLink href={buildHref(Math.min(page + 1, totalPages))} disabled={page >= totalPages}>
        ›
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="rounded-md px-2.5 py-1 text-zinc-300">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100">
      {children}
    </Link>
  );
}
