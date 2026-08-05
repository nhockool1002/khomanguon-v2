import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PublicRateLimitService } from './public-rate-limit.service';
import { RATE_LIMIT_KEY, type RateLimitName } from './rate-limit-key.decorator';

@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: PublicRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.get<RateLimitName | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!key) return true;

    const request = context.switchToHttp().getRequest<Request>();
    await this.rateLimitService.check(key, request.ip ?? 'unknown');
    return true;
  }
}
