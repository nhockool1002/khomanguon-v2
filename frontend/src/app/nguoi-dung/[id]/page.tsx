import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublicProfile } from "@/lib/public-api";
import { StyledUserName } from "@/components/styled-user-name";
import { ProfileMessages } from "@/components/profile-messages";
import { formatDate } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await fetchPublicProfile(id);
  if (!profile) return {};
  return { title: `${profile.displayName} — khomanguon` };
}

// Trang profile công khai — mọi nơi hiển thị tên user (byline, bình luận, member đã tải...) đều
// trỏ về đây khi bấm vào (xem components/styled-user-name.tsx).
export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;
  const profile = await fetchPublicProfile(id);
  if (!profile) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5">
        <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-[#2b3f5c] text-2xl uppercase text-white">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            profile.displayName.charAt(0)
          )}
        </span>
        <div className="flex flex-col gap-1">
          <StyledUserName
            styleRoleSlug={profile.styleRoleSlug}
            className="text-xl font-semibold text-zinc-900"
          >
            {profile.displayName}
          </StyledUserName>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>Thành viên từ {formatDate(profile.createdAt)}</span>
            {profile.roleNames.length > 0 && (
              <>
                <span>·</span>
                <span>{profile.roleNames.join(", ")}</span>
              </>
            )}
          </div>
          {profile.bio && <p className="mt-1 text-sm text-zinc-700">{profile.bio}</p>}
        </div>
      </div>

      <ProfileMessages profileUserId={profile.id} />
    </main>
  );
}
