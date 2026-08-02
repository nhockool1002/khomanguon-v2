export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatViewCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k lượt xem`;
  return `${count} lượt xem`;
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}
