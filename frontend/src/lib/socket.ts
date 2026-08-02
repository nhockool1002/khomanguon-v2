"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, getAccessToken } from "./api";

export interface WalletUpdatedPayload {
  balance: number;
  topupOrderId?: string;
}

// Kết nối WebSocket ví — mỗi user join room riêng "wallet:{userId}" phía server (xem
// backend/src/realtime/wallet.gateway.ts), nên FE chỉ cần lắng nghe, không cần lọc gì thêm.
// `enabled` nên = !!user từ useAuth() — chỉ kết nối khi đã có access token thật.
export function useWalletSocket(enabled: boolean, onUpdate: (payload: WalletUpdatedPayload) => void) {
  useEffect(() => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) return;

    const socket: Socket = io(API_URL, {
      auth: { token },
      withCredentials: true,
      transports: ["websocket"],
    });
    socket.on("wallet.updated", onUpdate);

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
