import Link from "next/link";

// Chip phân trang "‹ 1 2 3 ›" cho trang chủ/danh mục (wireframe #02).
export function Pagination({
  baseHref,
  page,
  totalPages,
}: {
  baseHref: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="flex items-center justify-center gap-1.5 py-6 font-mono text-sm">
      <PageLink href={`${baseHref}?page=${Math.max(page - 1, 1)}`} disabled={page <= 1}>
        ‹
      </PageLink>
      {pages.map((p) => (
        <Link
          key={p}
          href={`${baseHref}?page=${p}`}
          className={`rounded-md px-2.5 py-1 ${
            p === page
              ? "bg-[#1d3557] text-white"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {p}
        </Link>
      ))}
      <PageLink
        href={`${baseHref}?page=${Math.min(page + 1, totalPages)}`}
        disabled={page >= totalPages}
      >
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
