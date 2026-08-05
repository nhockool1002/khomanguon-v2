import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PostViewTrackerService } from './post-view-tracker.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PostsController],
  providers: [PostsService, PostViewTrackerService],
  exports: [PostsService],
})
export class PostsModule {}
