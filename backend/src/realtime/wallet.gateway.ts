import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../auth/guards/jwt-auth.guard';

// Đẩy realtime số dư ví sau khi SePay xác nhận nạp tiền (UC09/UC23) — mỗi user 1 room riêng
// "wallet:{userId}" nên không cần lọc phía client, cứ nhận là của chính mình.
// Chỉ 1 instance backend hiện tại (docker-compose không chạy nhiều replica) nên không cần Redis
// adapter — nếu scale ngang sau này, thêm @socket.io/redis-adapter ở đây.
@Injectable()
@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => callback(null, true), // allowlist thật do main.ts lo cho HTTP; socket handshake tự xác thực bằng JWT bên dưới
    credentials: true,
  },
})
export class WalletGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WalletGateway.name);

  @WebSocketServer()
  private server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      await client.join(`wallet:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Không cần dọn gì thêm — socket.io tự rời hết room khi disconnect.
  }

  emitWalletUpdated(userId: string, payload: { balance: number; topupOrderId?: string }): void {
    this.server?.to(`wallet:${userId}`).emit('wallet.updated', payload);
  }
}
