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

// Đẩy realtime thông báo @mention — mỗi user 1 room riêng "notif:{userId}", sao y cấu trúc
// wallet.gateway.ts (xem comment ở đó về CORS/scale ngang).
@Injectable()
@WebSocketGateway({
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => callback(null, true),
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationGateway.name);

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
      await client.join(`notif:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Không cần dọn gì thêm — socket.io tự rời hết room khi disconnect.
  }

  emitNotification(userId: string, payload: unknown): void {
    this.server?.to(`notif:${userId}`).emit('notification.new', payload);
  }
}
