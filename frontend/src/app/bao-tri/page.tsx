import { redirect } from "next/navigation";
import { fetchGeneralSettings } from "@/lib/public-api";
import { MaintenancePage } from "@/components/maintenance-page";

// Đích đến thật của redirect trong maintenance-gate.tsx (client, so trạng thái đăng nhập/quyền).
// Route riêng thay vì render đè tại chỗ — có URL thật để chia sẻ/refresh lại đều ra đúng trang này.
// Nếu ai đó vào thẳng URL này lúc Chế độ Bảo trì đã tắt (link cũ còn lưu, admin vừa tắt...) thì đưa
// về trang chủ luôn, không hiện nhầm trang bảo trì khi thực ra site đã hoạt động bình thường.
export default async function MaintenanceRoutePage() {
  const settings = await fetchGeneralSettings();
  if (!settings.maintenanceMode.enabled) redirect("/");

  return <MaintenancePage message={settings.maintenanceMode.message} />;
}
