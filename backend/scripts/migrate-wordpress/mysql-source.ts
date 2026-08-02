import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';

export interface WpUserRow extends RowDataPacket {
  ID: number;
  user_email: string;
  user_registered: Date;
  display_name: string;
}

export interface WpUserMetaRow extends RowDataPacket {
  user_id: number;
  meta_key: string;
  meta_value: string;
}

export interface WpTermRow extends RowDataPacket {
  term_id: number;
  name: string;
  slug: string;
}

export interface WpTermTaxonomyRow extends RowDataPacket {
  term_taxonomy_id: number;
  term_id: number;
  taxonomy: string;
  parent: number;
}

export interface WpPostRow extends RowDataPacket {
  ID: number;
  post_author: number;
  post_date: Date;
  post_content: string;
  post_title: string;
  post_excerpt: string;
  post_status: string;
  post_name: string;
  post_parent: number;
  post_type: string;
}

export interface WpPostMetaRow extends RowDataPacket {
  post_id: number;
  meta_key: string;
  meta_value: string;
}

export interface WpTermRelationshipRow extends RowDataPacket {
  object_id: number;
  term_taxonomy_id: number;
}

export interface WpCommentRow extends RowDataPacket {
  comment_ID: number;
  comment_post_ID: number;
  comment_author: string;
  comment_author_email: string;
  comment_date: Date;
  comment_content: string;
  comment_approved: string;
  comment_parent: number;
  user_id: number;
}

export interface WpFileDownloadRow extends RowDataPacket {
  id: number;
  user_id: number;
  post_id: number;
  provider: string;
  object_key: string;
  cash_amount: number;
  downloaded_at: Date;
}

export interface WpPointRow extends RowDataPacket {
  user_id: number;
  point_amount: number;
}

export interface WpPointHistoryRow extends RowDataPacket {
  id: number;
  user_id: number;
  operation: '+' | '-';
  amount: number;
  reason: string;
  timestamp: Date;
}

export class WpSource {
  private constructor(private readonly pool: Pool) {}

  static connect(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }): WpSource {
    return new WpSource(mysql.createPool({ ...config, connectionLimit: 5 }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async users(): Promise<WpUserRow[]> {
    const [rows] = await this.pool.query<WpUserRow[]>(
      'SELECT ID, user_email, user_registered, display_name FROM src_users ORDER BY ID',
    );
    return rows;
  }

  async userMeta(metaKey: string): Promise<WpUserMetaRow[]> {
    const [rows] = await this.pool.query<WpUserMetaRow[]>(
      'SELECT user_id, meta_key, meta_value FROM src_usermeta WHERE meta_key = ?',
      [metaKey],
    );
    return rows;
  }

  async terms(): Promise<WpTermRow[]> {
    const [rows] = await this.pool.query<WpTermRow[]>(
      'SELECT term_id, name, slug FROM src_terms ORDER BY term_id',
    );
    return rows;
  }

  async termTaxonomies(taxonomy: 'category' | 'post_tag'): Promise<WpTermTaxonomyRow[]> {
    const [rows] = await this.pool.query<WpTermTaxonomyRow[]>(
      'SELECT term_taxonomy_id, term_id, taxonomy, parent FROM src_term_taxonomy WHERE taxonomy = ?',
      [taxonomy],
    );
    return rows;
  }

  async posts(postType: 'post' | 'attachment'): Promise<WpPostRow[]> {
    const [rows] = await this.pool.query<WpPostRow[]>(
      `SELECT ID, post_author, post_date, post_content, post_title, post_excerpt,
              post_status, post_name, post_parent, post_type
       FROM src_posts WHERE post_type = ? ORDER BY ID`,
      [postType],
    );
    return rows;
  }

  async postMetaByKey(metaKey: string): Promise<WpPostMetaRow[]> {
    const [rows] = await this.pool.query<WpPostMetaRow[]>(
      'SELECT post_id, meta_key, meta_value FROM src_postmeta WHERE meta_key = ?',
      [metaKey],
    );
    return rows;
  }

  async termRelationships(): Promise<WpTermRelationshipRow[]> {
    const [rows] = await this.pool.query<WpTermRelationshipRow[]>(
      'SELECT object_id, term_taxonomy_id FROM src_term_relationships',
    );
    return rows;
  }

  async comments(): Promise<WpCommentRow[]> {
    const [rows] = await this.pool.query<WpCommentRow[]>(
      `SELECT comment_ID, comment_post_ID, comment_author, comment_author_email, comment_date,
              comment_content, comment_approved, comment_parent, user_id
       FROM src_comments WHERE comment_type = 'comment' ORDER BY comment_ID`,
    );
    return rows;
  }

  async fileDownloads(): Promise<WpFileDownloadRow[]> {
    const [rows] = await this.pool.query<WpFileDownloadRow[]>(
      `SELECT id, user_id, post_id, provider, object_key, cash_amount, downloaded_at
       FROM src_khomanguon_file_downloads ORDER BY downloaded_at ASC`,
    );
    return rows;
  }

  async points(): Promise<WpPointRow[]> {
    const [rows] = await this.pool.query<WpPointRow[]>(
      'SELECT user_id, point_amount FROM src_point',
    );
    return rows;
  }

  async pointHistory(): Promise<WpPointHistoryRow[]> {
    const [rows] = await this.pool.query<WpPointHistoryRow[]>(
      `SELECT id, user_id, operation, amount, reason, timestamp
       FROM src_point_history ORDER BY timestamp ASC, id ASC`,
    );
    return rows;
  }
}
