import { apiFetch, API_URL } from "./api";

// Backend trả về path tương đối (/uploads/xxx) — ghép NEXT_PUBLIC_API_URL ngay tại đây
// để mọi nơi lưu contentHtml/thumbnailUrl/ogImageUrl đều là URL tuyệt đối, không cần
// resolve lại lúc render (đơn giản hoá việc backend không tự biết public origin của mình
// khi đứng sau reverse proxy).
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const { url } = await apiFetch<{ url: string }>("/uploads", {
    method: "POST",
    body: formData,
  });
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}
