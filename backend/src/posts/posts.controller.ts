import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostStatus } from '@prisma/client';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

interface AuthUser {
  id: string;
  email: string;
}

function parsePageQuery(page?: string, limit?: string) {
  return { page: Number(page) || 1, limit: Number(limit) || 12 };
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // Danh sách công khai — chỉ bài PUBLISHED (wireframe #01/#02), hỗ trợ tìm kiếm + sắp xếp (UC05).
  @Get()
  list(
    @Query('category') categorySlug?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: 'newest' | 'popular',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.postsService.listPublic({
      categorySlug,
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

  // Chi tiết công khai theo slug (wireframe #03).
  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.postsService.getBySlugPublic(slug);
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
