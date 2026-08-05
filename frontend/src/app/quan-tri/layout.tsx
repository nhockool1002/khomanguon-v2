import { AdminSidebar } from "@/components/admin-sidebar";
import { UploadQueueProvider } from "@/context/upload-queue-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Mount ở layout (không phải trong trang upload) để hàng đợi sống suốt vòng đời /quan-tri/* —
    // điều hướng SPA sang trang admin khác rồi quay lại vẫn giữ nguyên tiến độ, xem
    // context/upload-queue-context.tsx.
    <UploadQueueProvider>
      <div className="flex flex-1">
        <AdminSidebar />
        <div className="flex-1 bg-zinc-50">{children}</div>
      </div>
    </UploadQueueProvider>
  );
}
