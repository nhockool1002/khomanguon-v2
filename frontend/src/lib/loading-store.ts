// External store (không dùng React Context) đếm số apiFetch() đang chạy đồng thời — cho phép hook
// thẳng vào lib/api.ts (hàm thuần, không phải component) mà vẫn có nơi cho GlobalLoadingBar
// subscribe qua useSyncExternalStore. Chỉ emit khi boolean "đang loading" thật sự đổi (0<->1), không
// phải mỗi lần count đổi, để tránh re-render thừa khi nhiều request chạy song song.
type Listener = () => void;

let count = 0;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function beginRequest() {
  count += 1;
  if (count === 1) emitChange();
}

export function endRequest() {
  count = Math.max(0, count - 1);
  if (count === 0) emitChange();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): boolean {
  return count > 0;
}

export function getServerSnapshot(): boolean {
  return false;
}
