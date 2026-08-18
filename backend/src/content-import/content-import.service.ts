import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import * as mammoth from 'mammoth';
import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { MediaService } from '../media/media.service';
import { guessImageMimeType } from '../common/mime-by-ext.util';

// Cho phép thêm "img" (sanitize-html KHÔNG bật mặc định dù có sẵn allowedAttributes.img — dễ hiểu
// nhầm) và "style"/"class" trên mọi thẻ — cần cho layout tuyệt đối pdftohtml sinh ra (mỗi đoạn text
// là 1 <p style="position:absolute;..."> để giữ đúng vị trí như file gốc) và các thuộc tính
// width/height/margin... mammoth/trình soạn hay dùng. Không bật iframe/script/object — giữ nguyên
// mức an toàn mặc định của sanitize-html cho các thẻ có thể chạy mã.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    '*': ['style', 'class', 'id'],
    img: ['src', 'alt', 'title', 'width', 'height', 'style'],
    a: ['href', 'name', 'target', 'style'],
  },
  allowedSchemes: ['http', 'https', 'data'],
};

const REMOTE_IMAGE_TIMEOUT_MS = 8000;
const REMOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

interface UploadImageParams {
  uploadedById: string;
  storageProviderId?: string;
}

@Injectable()
export class ContentImportService {
  private readonly logger = new Logger(ContentImportService.name);

  constructor(private readonly mediaService: MediaService) {}

  // docx → HTML qua mammoth — giữ định dạng tốt cho văn bản Word thường gặp (tiêu đề, đậm/nghiêng,
  // danh sách, bảng...), ảnh nhúng được mammoth tách ra qua convertImage() callback, tải lên Thư
  // viện Media qua uploadBuffer() rồi mới ghép URL thật vào <img src>.
  async fromDocx(buffer: Buffer, params: UploadImageParams): Promise<string> {
    let imageIndex = 0;
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          imageIndex += 1;
          try {
            const imgBuffer = await image.readAsBuffer();
            const { url } = await this.mediaService.uploadBuffer({
              buffer: imgBuffer,
              mimetype: image.contentType,
              originalName: `docx-image-${imageIndex}`,
              uploadedById: params.uploadedById,
              storageProviderId: params.storageProviderId,
            });
            return { src: url };
          } catch (err) {
            // Lỗi 1 ảnh (định dạng lạ, upload thất bại...) không nên làm hỏng cả bài — bỏ ảnh đó,
            // giữ nguyên phần còn lại của tài liệu.
            this.logger.warn(
              `Bỏ qua ảnh #${imageIndex} trong docx: ${(err as Error).message}`,
            );
            return { src: '' };
          }
        }),
      },
    );
    return sanitizeHtml(result.value, SANITIZE_OPTIONS);
  }

  // .html → walk toàn bộ <img>, ảnh dán trực tiếp (data: base64) hoặc ảnh trỏ URL ngoài đều tải về
  // Thư viện Media rồi thay src — nội dung sau khi chèn vào bài viết không còn phụ thuộc nguồn ngoài
  // (ảnh mất nếu domain gốc sập/đổi). Sanitize sau cùng để loại script/on* trước khi trả về.
  async fromHtml(html: string, params: UploadImageParams): Promise<string> {
    const $ = load(html);
    const images = $('img').toArray();

    for (const img of images) {
      const src = $(img).attr('src');
      if (!src) continue;

      const dataUriMatch =
        /^data:([^;,]+)(?:;charset=[^;,]+)?;base64,(.+)$/.exec(src);
      if (dataUriMatch) {
        const [, mimetype, base64] = dataUriMatch;
        try {
          const { url } = await this.mediaService.uploadBuffer({
            buffer: Buffer.from(base64, 'base64'),
            mimetype,
            originalName: 'pasted-image',
            uploadedById: params.uploadedById,
            storageProviderId: params.storageProviderId,
          });
          $(img).attr('src', url);
        } catch (err) {
          this.logger.warn(
            `Bỏ qua ảnh base64 trong html: ${(err as Error).message}`,
          );
        }
        continue;
      }

      if (/^https?:\/\//i.test(src)) {
        try {
          const { buffer, mimetype } = await this.fetchBoundedImage(src);
          const { url } = await this.mediaService.uploadBuffer({
            buffer,
            mimetype,
            originalName: basename(new URL(src).pathname) || 'imported-image',
            uploadedById: params.uploadedById,
            storageProviderId: params.storageProviderId,
          });
          $(img).attr('src', url);
        } catch (err) {
          // Ảnh ngoài tải lỗi (mất mạng/hết hạn/quá lớn) — giữ nguyên src gốc thay vì làm hỏng cả
          // bài, người viết vẫn thấy ảnh (trỏ thẳng nguồn ngoài) và có thể tự thay sau.
          this.logger.warn(
            `Giữ nguyên src ảnh ngoài (tải lỗi): ${(err as Error).message}`,
          );
        }
      }
    }

    return sanitizeHtml($.html(), SANITIZE_OPTIONS);
  }

  // .pdf → pdftohtml (poppler-utils, xem Dockerfile) chế độ "complex" (-c -s -noframes): mỗi trang
  // ra 1 ảnh nền (raster hoá toàn bộ phần đồ hoạ/ảnh của trang) + text đặt tuyệt đối đè lên trên —
  // đây là cách duy nhất giữ được layout gần như nguyên bản khi chuyển PDF (định dạng cố định trang)
  // sang HTML (định dạng chảy tự do). Coi mỗi ảnh nền trang như 1 ảnh thường, tải lên Thư viện Media
  // như các luồng docx/html ở trên.
  async fromPdf(buffer: Buffer, params: UploadImageParams): Promise<string> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'content-import-pdf-'));
    try {
      const pdfPath = join(tmpDir, 'input.pdf');
      await writeFile(pdfPath, buffer);
      const outBase = join(tmpDir, 'out');

      await this.runPdfToHtml(pdfPath, outBase);

      const html = await readFile(`${outBase}.html`, 'utf-8');
      const $ = load(html);
      const images = $('img').toArray();

      for (const img of images) {
        const src = $(img).attr('src');
        // pdftohtml sinh ảnh nền dạng file cục bộ cùng thư mục (vd "out001.png") — bỏ qua nếu đã là
        // URL tuyệt đối (không xảy ra với output của chính pdftohtml, phòng hờ input html lạ).
        if (!src || /^https?:\/\//i.test(src) || src.startsWith('data:'))
          continue;
        try {
          const imgBuffer = await readFile(join(tmpDir, src));
          const { url } = await this.mediaService.uploadBuffer({
            buffer: imgBuffer,
            mimetype: guessImageMimeType(src),
            originalName: src,
            uploadedById: params.uploadedById,
            storageProviderId: params.storageProviderId,
          });
          $(img).attr('src', url);
        } catch (err) {
          this.logger.warn(
            `Bỏ qua ảnh trang PDF (${src}): ${(err as Error).message}`,
          );
        }
      }

      const bodyHtml = $('body').html() ?? '';
      // Mỗi trang PDF là 1 khối kích thước cố định theo px (page1-div, page2-div...) — bọc
      // overflow-x:auto để trang PDF khổ lớn không đẩy vỡ layout bài viết (cột nội dung có
      // max-width), thay vì cố tính lại toạ độ tuyệt đối cho responsive (không khả thi mà vẫn giữ
      // đúng layout gốc).
      return sanitizeHtml(
        `<div class="pdf-import-content" style="max-width:100%;overflow-x:auto;">${bodyHtml}</div>`,
        SANITIZE_OPTIONS,
      );
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }

  private runPdfToHtml(pdfPath: string, outBase: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const errChunks: Buffer[] = [];
      const child = spawn('pdftohtml', [
        '-c',
        '-s',
        '-noframes',
        pdfPath,
        outBase,
      ]);
      child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));
      child.on('error', (err) => {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          reject(
            new Error(
              'Máy chủ chưa cài poppler-utils (lệnh pdftohtml) — không xử lý được PDF',
            ),
          );
          return;
        }
        reject(err);
      });
      child.on('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `pdftohtml thoát mã ${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 500)}`,
            ),
          );
          return;
        }
        resolve();
      });
    });
  }

  private async fetchBoundedImage(
    url: string,
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      REMOTE_IMAGE_TIMEOUT_MS,
    );
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentLength = Number(res.headers.get('content-length') ?? '0');
      if (contentLength > REMOTE_IMAGE_MAX_BYTES) {
        throw new Error('Ảnh vượt quá 10MB');
      }
      const arrayBuffer = await res.arrayBuffer();
      if (arrayBuffer.byteLength > REMOTE_IMAGE_MAX_BYTES) {
        throw new Error('Ảnh vượt quá 10MB');
      }
      const mimetype =
        res.headers.get('content-type')?.split(';')[0] ??
        guessImageMimeType(new URL(url).pathname);
      return { buffer: Buffer.from(arrayBuffer), mimetype };
    } finally {
      clearTimeout(timeout);
    }
  }
}
