import { fetchGeneralSettings, fetchPosts } from "@/lib/public-api";
import { PostCard } from "@/components/post-card";
import { Pagination } from "@/components/pagination";
import { WidgetArea } from "@/components/widget-area";
import { fontVar } from "@/lib/fonts";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(Number(pageParam) || 1, 1);

  const settings = await fetchGeneralSettings();
  const pageSize = settings.postsPerPage;
  const { items: posts, total } = await fetchPosts({ page, limit: pageSize });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const heroStyle: React.CSSProperties = settings.headerBackgroundImageUrl
    ? {
        backgroundColor: settings.headerBackgroundColor,
        backgroundImage: `url(${settings.headerBackgroundImageUrl})`,
        backgroundSize: settings.headerBackgroundSize,
        backgroundAttachment: settings.headerBackgroundAttachment,
        backgroundPosition: `${settings.headerBackgroundPositionX}% ${settings.headerBackgroundPositionY}%`,
        backgroundRepeat: "no-repeat",
      }
    : { backgroundColor: settings.headerBackgroundColor };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8">
      <section
        className="flex flex-col justify-center rounded-lg px-8 py-10 text-white"
        style={{ ...heroStyle, minHeight: settings.headerMinHeight }}
      >
        <p
          className="font-mono text-xs uppercase tracking-widest"
          style={{
            color: settings.headerTitleColor,
            fontFamily: fontVar(settings.headerTitleFontFamily),
            fontWeight: settings.headerTitleBold ? 700 : undefined,
          }}
        >
          {settings.headerTitle}
        </p>
        {settings.headerSlogan && (
          <h1
            className="mt-2 max-w-lg text-2xl"
            style={{
              color: settings.headerSloganColor,
              fontFamily: fontVar(settings.headerSloganFontFamily),
              fontWeight: settings.headerSloganBold ? 700 : undefined,
              fontStyle: settings.headerSloganItalic ? "italic" : undefined,
            }}
          >
            {settings.headerSlogan}
          </h1>
        )}
      </section>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-4 lg:flex-[3]">
          <h2 className="text-sm font-semibold text-zinc-900">Bài viết mới nhất</h2>
          {posts.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
              Chưa có bài viết nào được đăng.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
          <Pagination baseHref="/" page={page} totalPages={totalPages} />
        </div>

        <div className="lg:flex-1">
          <WidgetArea area="sidebar" />
        </div>
      </div>
    </main>
  );
}
