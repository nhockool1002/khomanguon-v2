import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PostStatus, UserActivityType } from '@prisma/client';
import { PostsService } from './posts.service';
import { PostViewTrackerService } from './post-view-tracker.service';
import { BookmarksService } from '../bookmarks/bookmarks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserActivityService } from '../user-activity/user-activity.service';
import { PublicRateLimitGuard } from '../common/rate-limit/public-rate-limit.guard';
import { RateLimitKey } from '../common/rate-limit/rate-limit-key.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Cacheable } from '../cache/cacheable.decorator';
import { HttpCacheInterceptor } from '../cache/http-cache.interceptor';

interface AuthUser {
  id: string;
  email: string;
}

function parsePageQuery(page?: string, limit?: string) {
  return { page: Number(page) || 1, limit: Number(limit) || 12 };
}

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postViewTracker: PostViewTrackerService,
    private readonly userActivity: UserActivityService,
    private readonly bookmarksService: BookmarksService,
  ) {}

  // Danh sách công khai — chỉ bài PUBLISHED (wireframe #01/#02), hỗ trợ tìm kiếm + sắp xếp (UC05).
  // Rate limit áp cho cả route (browse lẫn tìm kiếm dùng chung 1 handler) — ngưỡng mặc định đủ
  // rộng cho duyệt trang bình thường, chặn spam tìm kiếm/scrape hàng loạt.
  @UseGuards(PublicRateLimitGuard)
  @RateLimitKey('search')
  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('posts', 60)
  @Get()
  list(
    @Query('category') categorySlug?: string,
    @Query('tag') tagSlug?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: 'newest' | 'popular',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.listPublic({
      categorySlug,
      tagSlug,
      q,
      sort,
      ...parsePageQuery(page, limit),
    });
  }

  // Danh sách cho khu vực quản trị (mọi trạng thái) — phải khai báo trước ":slug".
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Get('admin/list')
  listAdmin(
    @Query('status') status?: PostStatus,
    @Query('category') categorySlug?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.listAdmin({
      status,
      categorySlug,
      ...parsePageQuery(page, limit),
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Get('admin/:id')
  getByIdAdmin(@Param('id') id: string) {
    return this.postsService.getByIdAdmin(id);
  }

  // Chi tiết công khai theo slug (wireframe #03) — cache 120s, pure read (không tăng viewCount ở
  // đây nữa, xem PostsService.getBySlugPublic + endpoint POST :id/view bên dưới).
  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('posts', 120)
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.postsService.getBySlugPublic(slug);
  }

  // Widget "Bài viết liên quan" — công khai, cache như GET :slug (không phụ thuộc user).
  @UseInterceptors(HttpCacheInterceptor)
  @Cacheable('posts', 120)
  @Get(':id/related')
  getRelated(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.postsService.getRelatedPosts(id, Number(limit) || 5);
  }

  // Trạng thái "đã lưu" của bài này với user hiện tại — KHÔNG @Cacheable (theo từng user, khác
  // GET :id/related ở trên). Trả false thẳng nếu chưa đăng nhập thay vì 401, để nút Bookmark ở FE
  // luôn render được (chỉ đổi hành vi khi bấm — điều hướng đăng nhập lúc đó).
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id/bookmark-status')
  getBookmarkStatus(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.bookmarksService.getStatus(user?.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/bookmark')
  toggleBookmark(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bookmarksService.toggle(user.id, id);
  }

  // Đếm lượt xem — endpoint riêng do TRÌNH DUYỆT gọi sau khi trang bài viết tải xong (xem
  // components/post-view-tracker.tsx), tách khỏi GET :slug ở trên vì route đó được Server Component
  // Next.js gọi (luôn từ server, không phải trình duyệt người xem) nên không có IP/identity thật để
  // chống F5 spam. OptionalJwtAuthGuard: biết userId nếu đăng nhập (identity chính xác hơn IP, tránh
  // đếm hụt khi nhiều người chung IP/NAT) nhưng không chặn khách ẩn danh.
  @UseGuards(OptionalJwtAuthGuard)
  @Post(':id/view')
  async registerView(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Ip() ip: string,
  ) {
    const identity = user?.id ?? ip;
    if (this.postViewTracker.shouldCount(id, identity)) {
      const post = await this.postsService.registerView(id);
      // Chỉ log activity khi đăng nhập (chưa biết "user vô danh nào" nếu ẩn danh) và khi thật sự
      // tính là 1 view mới (shouldCount đã lọc F5 spam) — không log trùng mỗi lần F5.
      if (user && post) {
        void this.userActivity.log(
          user.id,
          UserActivityType.VIEW_POST,
          { postTitle: post.title, postSlug: post.slug },
          ip,
        );
      }
    }
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_CREATE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  // Không dùng @Permissions cố định vì cần cho phép "sửa bài của chính mình" (post.edit.own)
  // hoặc "sửa bất kỳ bài nào" (post.edit.any) — kiểm tra chi tiết nằm trong PostsService.update.
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.POST_DELETE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.postsService.remove(id);
  }
}
