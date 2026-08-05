"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { apiFetch } from "@/lib/api";

interface RecaptchaConfigPublic {
  enabled: boolean;
  siteKey: string;
}

interface Grecaptcha {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
    },
  ) => number;
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

// Widget reCAPTCHA v2 checkbox — chỉ render khi Admin đã bật ở /quan-tri/cai-dat/chung (fetch
// GET /recaptcha/config, public). Dùng render tường minh (grecaptcha.render) thay vì để script tự
// quét DOM (implicit render) — script quét DOM CHỈ 1 LẦN lúc load, nếu user điều hướng SPA (đăng ký
// -> đăng nhập) mà không reload trang, script không quét lại nên widget trang sau sẽ không hiện.
// onReady của next/script chạy lại đúng mỗi lần component remount (kể cả sau điều hướng SPA, khác
// onLoad chỉ chạy đúng 1 lần) — dùng để trigger render lại cho đúng.
export function RecaptchaWidget({
  onVerify,
}: {
  onVerify: (token: string | undefined) => void;
}) {
  const [config, setConfig] = useState<RecaptchaConfigPublic | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  useEffect(() => {
    apiFetch<RecaptchaConfigPublic>("/recaptcha/config")
      .then(setConfig)
      .catch(() => setConfig({ enabled: false, siteKey: "" }));
  }, []);

  useEffect(() => {
    if (!config?.enabled || !scriptReady || renderedRef.current) return;
    if (!containerRef.current || !window.grecaptcha) return;
    window.grecaptcha.render(containerRef.current, {
      sitekey: config.siteKey,
      callback: (token: string) => onVerify(token),
      "expired-callback": () => onVerify(undefined),
    });
    renderedRef.current = true;
  }, [config, scriptReady, onVerify]);

  if (!config?.enabled) return null;

  return (
    <>
      <Script
        src="https://www.google.com/recaptcha/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
