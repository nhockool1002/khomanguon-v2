import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

interface AuthUser {
  id: string;
  email: string;
}

// Toggle/status của bookmark theo TỪNG bài nằm ở PostsController (POST/DELETE/GET
// /posts/:id/bookmark*) — controller này chỉ có 1 việc: danh sách "Bài viết đã lưu" của chính mình.
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  listMine(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bookmarksService.listMine(
      user.id,
      Number(page) || 1,
      Number(limit) || 12,
    );
  }
}
