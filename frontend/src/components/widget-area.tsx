import Link from "next/link";
import { fetchCategories, fetchPosts, fetchWidgets } from "@/lib/public-api";
import { formatDate } from "@/lib/format";
import type { Widget } from "@/lib/types";

// Server Component — dùng chung cho trang chủ và trang bài viết (cả 2 đều là Server Component sẵn),
// đọc danh sách widget đã cấu hình qua /quan-tri/widget thay vì hard-code sidebar riêng từng trang.
export async function WidgetArea({ area }: { area: string }) {
  const widgets = await fetchWidgets(area);
  if (widgets.length === 0) return null;

  return (
    <aside className="flex flex-col gap-4 lg:flex-1">
      {widgets.map((widget) => (
        <WidgetRenderer key={widget.id} widget={widget} />
      ))}
    </aside>
  );
}

async function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case "SEARCH":
      return <SearchWidget />;
    case "CATEGORIES":
      return <CategoriesWidget title={widget.title} />;
    case "RECENT_POSTS":
      return <RecentPostsWidget title={widget.title} limit={Number(widget.config.limit) || 5} />;
    case "HTML":
      return <HtmlWidget title={widget.title} html={String(widget.config.html ?? "")} />;
    default:
      return null;
  }
}

function SearchWidget() {
  return (
    <form action="/tim-kiem" className="flex gap-2">
      <input
        type="text"
        name="q"
        placeholder="Tìm kiếm bài viết..."
        className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
      />
      <button
        type="submit"
        className="rounded-md bg-[#1d3557] px-3 py-2 text-sm font-medium text-white hover:bg-[#16294a]"
      >
        Tìm
      </button>
    </form>
  );
}

async function CategoriesWidget({ title }: { title: string }) {
  const categories = await fetchCategories();
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      {title && (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      )}
      {categories.length === 0 ? (
        <p className="text-xs text-zinc-400">Chưa có danh mục.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/danh-muc/${c.slug}`}
              className="rounded-full border border-zinc-200 px-2.5 py-1 font-mono text-xs text-zinc-600 hover:border-[#1d3557] hover:text-[#1d3557]"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

async function RecentPostsWidget({ title, limit }: { title: string; limit: number }) {
  const { items: posts } = await fetchPosts({ limit, sort: "newest" });
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      {title && (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      )}
      {posts.length === 0 ? (
        <p className="text-xs text-zinc-400">Chưa có bài viết.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {posts.map((post) => (
            <li key={post.id}>
              <Link href={`/bai-viet/${post.slug}`} className="text-sm text-zinc-700 hover:text-[#1d3557]">
                {post.title}
              </Link>
              <p className="font-mono text-xs text-zinc-400">{formatDate(post.publishedAt ?? post.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// HTML tự do do Admin nhập qua trang quản lý widget — cùng mức tin cậy với contentHtml của bài viết
// (đã qua permission gate WIDGET_MANAGE, không phải input công khai), nên render thẳng qua dangerouslySetInnerHTML.
function HtmlWidget({ title, html }: { title: string; html: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      {title && (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      )}
      <div className="prose prose-sm max-w-none text-zinc-700" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
