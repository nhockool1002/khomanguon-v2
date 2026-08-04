// Chân trang toàn site — text đổi được ở Cài đặt chung (settings.footerText), mặc định
// "KHOMANGUON Version 2 (C) 2026. All Rights Reserved.".
export function Footer({ text }: { text: string }) {
  return (
    <footer className="border-t border-zinc-200 bg-white px-6 py-5 text-center text-xs text-zinc-400">
      {text}
    </footer>
  );
}
