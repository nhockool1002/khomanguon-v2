import type { PrismaClient } from '@prisma/client';
import type { WpSource } from './mysql-source';
import type { Report } from './report';

export interface MigrationMaps {
  userIdToNewId: Map<number, string>;
  categoryTermIdToNewId: Map<number, string>;
  tagTermIdToNewId: Map<number, string>;
  postIdToNewId: Map<number, string>;
  postIdToSlug: Map<number, string>;
  // "2024/04/1.jpg" (đúng giá trị _wp_attached_file) -> URL mới sau khi upload — dùng để rewrite <img> trong content.
  attachmentRelPathToUrl: Map<string, string>;
  attachmentRelPathToSize: Map<string, number>;
  // WP attachment post ID -> URL mới — dùng để resolve _thumbnail_id.
  attachmentIdToUrl: Map<number, string>;
}

export interface MigrationContext {
  wp: WpSource;
  prisma: PrismaClient;
  dryRun: boolean;
  report: Report;
  maps: MigrationMaps;
  pictureDir: string;
  uploadsDir: string;
  apiBaseUrl: string;
}

export function createMaps(): MigrationMaps {
  return {
    userIdToNewId: new Map(),
    categoryTermIdToNewId: new Map(),
    tagTermIdToNewId: new Map(),
    postIdToNewId: new Map(),
    postIdToSlug: new Map(),
    attachmentRelPathToUrl: new Map(),
    attachmentRelPathToSize: new Map(),
    attachmentIdToUrl: new Map(),
  };
}
