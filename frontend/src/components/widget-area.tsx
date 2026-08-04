import Link from "next/link";
import { fetchCategories, fetchPosts, fetchWidgets } from "@/lib/public-api";
import { formatDate } from "@/lib/format";
import { CommentSection } from "@/components/comment-section";
import type { Widget } from "@/lib/types";

// Server Component — dùng chung cho trang chủ và trang bài viết (cả 2 đều là Server Component sẵn),
// đọc danh sách widget đã cấu hình qua /quan-tri/widget thay vì hard-code sidebar riêng từng trang.
// postId chỉ có ở trang bài viết — widget loại COMMENTS cần nó để biết bình luận của bài nào, nên bị
// lọc bỏ khi không có (vd trang chủ), dù admin đang để "Đang hiện".
export async function WidgetArea({ area, postId }: { area: string; postId?: string }) {
  const allWidgets = await fetchWidgets(area);
  const widgets = allWidgets.filter((w) => w.type !== "COMMENTS" || !!postId);
  if (widgets.length === 0) return null;

  // Không tự đặt lg:flex-1 ở đây nữa — sizing theo hàng (row) là việc của nơi gọi component này,
  // vì WidgetArea được lồng khác nhau tuỳ trang (trang chủ: con trực tiếp của hàng flex-row; trang
  // bài viết: lồng thêm 1 cấp cùng CommentSection trong 1 cột flex-col). Từng để lg:flex-1 ở đây
  // gây lỗi thật: trong ngữ cảnh flex-col, flex-1 nghĩa là "giãn theo chiều dọc" — khiến khối widget
  // giãn hết chiều cao cột (bằng chiều cao nội dung chính, có thể hàng nghìn px), đẩy CommentSection
  // tụt xuống tận đáy trang thay vì nằm ngay bên dưới widget.
  return (
    <aside className="flex flex-col gap-4">
      {widgets.map((widget) => (
        <WidgetRenderer key={widget.id} widget={widget} postId={postId} />
      ))}
    </aside>
  );
}

async function WidgetRenderer({ widget, postId }: { widget: Widget; postId?: string }) {
  switch (widget.type) {
    case "SEARCH":
      return <SearchWidget />;
    case "CATEGORIES":
      return <CategoriesWidget title={widget.title} />;
    case "RECENT_POSTS":
      return <RecentPostsWidget title={widget.title} limit={Number(widget.config.limit) || 5} />;
    case "HTML":
      return <HtmlWidget title={widget.title} html={String(widget.config.html ?? "")} />;
    case "COMMENTS": {
      // postId luôn có ở đây — widget-level filter phía trên đã loại bỏ trường hợp thiếu postId.
      if (!postId) return null;
      const sortOrder = widget.config.sortOrder === "oldest" ? "oldest" : "newest";
      const filterUserId =
        typeof widget.config.filterUserId === "string" && widget.config.filterUserId
          ? widget.config.filterUserId
          : undefined;
      return <CommentSection postId={postId} sortOrder={sortOrder} filterUserId={filterUserId} />;
    }
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
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <h3 className="mb-3 text-lg font-bold text-zinc-900">{title || "Bài viết mới"}</h3>
      {posts.length === 0 ? (
        <p className="text-xs text-zinc-400">Chưa có bài viết.</p>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {posts.map((post) => (
            <li key={post.id} className="flex items-start gap-2.5">
              <span
                className="recent-post-dot mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                aria-hidden
              />
              <div>
                <Link
                  href={`/bai-viet/${post.slug}`}
                  className="text-sm font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                >
                  {post.title}
                </Link>
                <p className="mt-0.5 font-mono text-xs text-zinc-400">
                  {formatDate(post.publishedAt ?? post.createdAt)}
                </p>
              </div>
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
