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
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { PermissionsGuard } from '../roles/guards/permissions.guard';
import { Permissions } from '../roles/decorators/permissions.decorator';
import { PERMISSIONS } from '../roles/permissions.constant';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateCommentDto } from './dto/create-comment.dto';
import {
  PinCommentDto,
  UpdateCommentStatusDto,
} from './dto/moderate-comment.dto';

interface AuthUser {
  id: string;
  email: string;
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // Công khai — nhưng giải mã token nếu có để trả đúng likedByMe (UC07, wireframe #03).
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(@Query('postId') postId: string, @CurrentUser() user?: AuthUser) {
    return this.commentsService.list(postId, user?.id);
  }

  // Moderator xem cả bình luận ẩn/chờ duyệt để kiểm duyệt ngay trên trang bài viết (UC08).
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.COMMENT_MODERATE)
  @Get('moderation')
  listForModeration(
    @Query('postId') postId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.commentsService.listForModeration(postId, user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.COMMENT_CREATE)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  toggleLike(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commentsService.toggleLike(user.id, id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.COMMENT_MODERATE)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateCommentStatusDto) {
    return this.commentsService.updateStatus(id, dto.status);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.COMMENT_MODERATE)
  @Patch(':id/pin')
  setPinned(@Param('id') id: string, @Body() dto: PinCommentDto) {
    return this.commentsService.setPinned(id, dto.pinned);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.COMMENT_MODERATE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.commentsService.remove(id);
  }
}
