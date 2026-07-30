import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      <AdminSidebar />
      <div className="flex-1 bg-zinc-50">{children}</div>
    </div>
  );
}
