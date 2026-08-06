import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { RolesModule } from './roles/roles.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CategoriesModule } from './categories/categories.module';
import { TagsModule } from './tags/tags.module';
import { PostsModule } from './posts/posts.module';
import { UploadsModule } from './uploads/uploads.module';
import { MenusModule } from './menus/menus.module';
import { CommentsModule } from './comments/comments.module';
import { StorageProvidersModule } from './storage-providers/storage-providers.module';
import { WalletModule } from './wallet/wallet.module';
import { DownloadLinksModule } from './download-links/download-links.module';
import { LinkReportsModule } from './link-reports/link-reports.module';
import { SepayModule } from './sepay/sepay.module';
import { RealtimeModule } from './realtime/realtime.module';
import { CloudFilesModule } from './cloud-files/cloud-files.module';
import { WidgetsModule } from './widgets/widgets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SiteSettingsModule } from './settings/site-settings.module';
import { MediaModule } from './media/media.module';
import { CacheModule } from './cache/cache.module';
import { UserActivityModule } from './user-activity/user-activity.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { RateLimitModule } from './common/rate-limit/rate-limit.module';
import { RecaptchaModule } from './recaptcha/recaptcha.module';
import { DbBackupModule } from './db-backup/db-backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    RolesModule,
    AuthModule,
    CacheModule,
    RateLimitModule,
    RecaptchaModule,
    DbBackupModule,
    UserActivityModule,
    AuditLogModule,
    UsersModule,
    CategoriesModule,
    TagsModule,
    PostsModule,
    UploadsModule,
    MenusModule,
    CommentsModule,
    StorageProvidersModule,
    WalletModule,
    DownloadLinksModule,
    LinkReportsModule,
    SepayModule,
    RealtimeModule,
    CloudFilesModule,
    WidgetsModule,
    NotificationsModule,
    SiteSettingsModule,
    MediaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
