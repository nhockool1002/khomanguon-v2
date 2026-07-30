import Link from "next/link";

// "Sắp xếp: Mới nhất ▾" (wireframe #02, UC05).
export function SortLinks({
  baseHref,
  extraQuery,
  sort,
}: {
  baseHref: string;
  extraQuery?: Record<string, string | undefined>;
  sort: "newest" | "popular";
}) {
  const buildHref = (value: "newest" | "popular") => {
    const params = new URLSearchParams();
    for (const [key, v] of Object.entries(extraQuery ?? {})) {
      if (v) params.set(key, v);
    }
    params.set("sort", value);
    return `${baseHref}?${params.toString()}`;
  };

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
      <span>Sắp xếp:</span>
      <Link
        href={buildHref("newest")}
        className={`rounded-full border px-2.5 py-1 ${
          sort === "newest"
            ? "border-[#1d3557] bg-[#1d3557] text-white"
            : "border-zinc-200 hover:border-[#1d3557] hover:text-[#1d3557]"
        }`}
      >
        Mới nhất
      </Link>
      <Link
        href={buildHref("popular")}
        className={`rounded-full border px-2.5 py-1 ${
          sort === "popular"
            ? "border-[#1d3557] bg-[#1d3557] text-white"
            : "border-zinc-200 hover:border-[#1d3557] hover:text-[#1d3557]"
        }`}
      >
        Phổ biến
      </Link>
    </div>
  );
}
