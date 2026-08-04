import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchPublicProfile } from "@/lib/public-api";
import { ProfilePage } from "@/components/profile-page";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await fetchPublicProfile(id);
  if (!profile) return {};
  return { title: `${profile.displayName} — khomanguon` };
}

// Server Component chỉ lo fetch ban đầu (SEO/metadata) + not-found — toàn bộ logic tab (Hồ sơ công
// khai / Thông tin / Bảo mật / Ví, ẩn hiện theo có phải profile của chính mình hay không) nằm ở
// components/profile-page.tsx (Client Component, cần useAuth()). Trang này giờ dùng chung cho cả
// xem profile người khác lẫn quản lý tài khoản của chính mình — /tai-khoan, /tai-khoan/vi cũ chỉ
// còn là redirect sang đây (xem app/tai-khoan/page.tsx).
export default async function UserProfilePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const profile = await fetchPublicProfile(id);
  if (!profile) notFound();

  return <ProfilePage profileId={id} initialProfile={profile} initialTab={tab} />;
}
