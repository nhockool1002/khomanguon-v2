import { fetchGeneralSettings } from "@/lib/public-api";
import { PageHero } from "@/components/page-hero";
import { WalletDashboard } from "@/components/wallet-dashboard";

export default async function WalletTopupPage() {
  const settings = await fetchGeneralSettings();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-8">
      <PageHero settings={settings} eyebrow="VÍ $P" title="Nạp tiền, chi tiêu minh bạch từng đồng" />
      <WalletDashboard />
    </div>
  );
}
