"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { formatFileSize } from "@/lib/format";
import type { CloudFile, StorageProvider } from "@/lib/types";
import { ErrorBanner, SuccessBanner } from "@/components/ui";
import { ForbiddenPage } from "@/components/forbidden-page";

function basename(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1] || key;
}

export default function CloudFilesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [providerId, setProviderId] = useState<string>("");
  const [prefix, setPrefix] = useState("");
  const [files, setFiles] = useState<CloudFile[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/dang-nhap");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<StorageProvider[]>("/storage-providers")
      .then((all) => {
        // MAILJET không phải file storage — không có gì để liệt kê file, loại khỏi danh sách chọn.
        const list = all.filter((p) => p.type !== "MAILJET");
        setProviders(list);
        setProviderId((current) => current || list[0]?.id || "");
      })
      .catch(() => setProviders([]));
  }, [user]);

  const loadFiles = useCallback(() => {
    if (!providerId) return;
    setFetching(true);
    setError(null);
    const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
    apiFetch<CloudFile[]>(`/storage-providers/${providerId}/files${query}`)
      .then(setFiles)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra"))
      .finally(() => setFetching(false));
  }, [providerId, prefix]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadFiles đặt cờ loading đồng bộ trước khi gọi API, đúng chủ đích
    if (providerId) loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId]);

  async function handleCopyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setMessage(`Đã copy: ${key}`);
    setTimeout(() => setMessage(null), 2000);
  }

  async function handleDelete(file: CloudFile) {
    if (!confirm(`Xoá file "${basename(file.key)}" khỏi bucket? Không thể hoàn tác.`)) return;
    setError(null);
    try {
      await apiFetch(`/storage-providers/${providerId}/files?key=${encodeURIComponent(file.key)}`, {
        method: "DELETE",
      });
      loadFiles();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Có lỗi xảy ra");
    }
  }

  const currentProvider = providers.find((p) => p.id === providerId);
  const totals = (files ?? []).reduce(
    (acc, f) => ({
      count: acc.count + 1,
      downloads: acc.downloads + f.downloadCount,
      revenue: acc.revenue + f.revenueP,
    }),
    { count: 0, downloads: 0, revenue: 0 },
  );

  if (loading || !user) {
    return <div className="px-8 py-16 text-center text-sm text-zinc-400">Đang tải...</div>;
  }
  if (!user.permissionKeys?.includes(PERMISSIONS.DOWNLOAD_MANAGE_LINKS)) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex w-full flex-col gap-4 px-8 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">Quản lý File Cloud</h1>
      <p className="text-sm text-zinc-500">
        Xem file thật đang nằm trong bucket, đối chiếu với cấu hình link tải (lượt tải, member đã
        tải, doanh thu $P) trong DB.
      </p>

      {providers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
          Chưa có storage provider nào — vào Cài đặt Storage để thêm trước.
        </p>
      ) : (
        <>
          <div className="flex gap-1 border-b border-zinc-200 font-mono text-sm">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setProviderId(p.id)}
                className={`border-b-2 px-3 py-2 ${
                  providerId === p.id
                    ? "border-[#1d3557] font-semibold text-[#1d3557]"
                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {currentProvider && (
            <div className="grid grid-cols-2 gap-3 rounded-md border border-zinc-200 p-4 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Loại</p>
                <p className="font-medium text-zinc-800">{currentProvider.type}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Bucket</p>
                <p className="font-medium text-zinc-800">{currentProvider.bucket}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">Upload prefix</p>
                <p className="font-medium text-zinc-800">{currentProvider.uploadPrefix || "/"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  {currentProvider.type === "R2" ? "Account ID" : "Endpoint"}
                </p>
                <p className="truncate font-medium text-zinc-800">{currentProvider.endpoint || "—"}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Lọc theo thư mục con (vd: posts/2026/06)"
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1d3557] focus:ring-1 focus:ring-[#1d3557]"
            />
            <button
              type="button"
              onClick={loadFiles}
              disabled={fetching}
              className="rounded-md bg-[#1d3557] px-4 py-2 text-sm font-medium text-white hover:bg-[#16294a] disabled:opacity-50"
            >
              {fetching ? "Đang tải..." : "Tải danh sách"}
            </button>
          </div>

          <ErrorBanner message={error} />
          <SuccessBanner message={message} />

          {files && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-2xl font-bold text-zinc-900">{totals.count}</p>
                <p className="text-xs text-zinc-500">Tổng số tệp</p>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-2xl font-bold text-zinc-900">{totals.downloads}</p>
                <p className="text-xs text-zinc-500">Tổng lượt tải</p>
              </div>
              <div className="rounded-md border border-zinc-200 p-3">
                <p className="text-2xl font-bold text-zinc-900">{totals.revenue} $P</p>
                <p className="text-xs text-zinc-500">Tổng doanh thu</p>
              </div>
            </div>
          )}

          {files && files.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-400">
              Không có file nào trong bucket (hoặc thư mục lọc).
            </p>
          )}

          {files && files.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-zinc-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Tên file</th>
                    <th className="px-3 py-2">Dung lượng</th>
                    <th className="px-3 py-2">Cập nhật</th>
                    <th className="px-3 py-2">Lượt tải</th>
                    <th className="px-3 py-2">Member tải</th>
                    <th className="px-3 py-2">Doanh thu</th>
                    <th className="px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.key} className="border-t border-zinc-100">
                      <td className="max-w-xs px-3 py-2">
                        <p className="truncate font-medium text-zinc-800" title={f.key}>
                          {basename(f.key)}
                        </p>
                        {f.linkedPostTitles.length > 0 && (
                          <p className="truncate text-xs text-zinc-400" title={f.linkedPostTitles.join(", ")}>
                            {f.linkedPostTitles[0]}
                            {f.linkedPostTitles.length > 1 ? ` +${f.linkedPostTitles.length - 1} khác` : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatFileSize(f.sizeBytes)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-zinc-500">
                        {f.lastModified ? new Date(f.lastModified).toLocaleString("vi-VN") : "—"}
                      </td>
                      <td className="px-3 py-2">{f.downloadCount}</td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-xs" title={f.memberNames.join(", ")}>
                        {f.memberNames.length > 0 ? f.memberNames.join(", ") : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">{f.revenueP} $P</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyKey(f.key)}
                            className="rounded px-2 py-1 text-xs font-medium text-[#1d3557] hover:bg-zinc-100"
                          >
                            Copy key
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(f)}
                            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-zinc-100"
                          >
                            Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
