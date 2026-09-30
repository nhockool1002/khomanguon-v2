import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

// Font mặc định của PDF (Helvetica) không có dấu tiếng Việt — tên hiển thị của user có thể có dấu,
// nên nhúng DejaVu Sans (gói npm dejavu-fonts-ttf, cài như dependency thường nên có sẵn cả trong
// image production).
const FONT_REGULAR = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

export interface IntlInvoiceData {
  invoiceNumber: string;
  code: string;
  approvedAt: Date;
  seller: { name: string; email: string };
  buyer: { name: string; email: string; userId: string };
  payerEmail: string | null;
  bmcTransactionRef: string;
  packageUsd: number;
  receivedUsdCents: number;
  creditedP: number;
  termsAcceptedAt: Date;
  termsIp: string | null;
}

function formatUtc(date: Date): string {
  return `${date.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)} USD`;
}

// Invoice cho giao dịch nạp quốc tế ĐÃ DUYỆT — tạo lại từ dữ liệu đơn mỗi lần cần (gửi mail/tải
// lại), không lưu file. Không chặn được chargeback, chỉ là bằng chứng khi tranh chấp: ghi rõ thời
// điểm + IP user đồng ý điều khoản "tín dụng số, không hoàn tiền" và mã giao dịch BMC.
@Injectable()
export class IntlTopupInvoiceService {
  render(data: IntlInvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('regular', FONT_REGULAR);
      doc.registerFont('bold', FONT_BOLD);

      doc.font('bold').fontSize(20).fillColor('#1d3557').text('INVOICE');
      doc
        .font('regular')
        .fontSize(10)
        .fillColor('#52525b')
        .text(`Invoice number: ${data.invoiceNumber}`)
        .text(`Reference code: ${data.code}`)
        .text(`Confirmed at: ${formatUtc(data.approvedAt)}`);
      doc.moveDown(1.5);

      const top = doc.y;
      doc
        .font('bold')
        .fontSize(11)
        .fillColor('#18181b')
        .text('Seller', 50, top);
      doc
        .font('regular')
        .fontSize(10)
        .fillColor('#3f3f46')
        .text(data.seller.name, 50)
        .text(data.seller.email, 50);
      doc
        .font('bold')
        .fontSize(11)
        .fillColor('#18181b')
        .text('Billed to', 300, top);
      doc
        .font('regular')
        .fontSize(10)
        .fillColor('#3f3f46')
        .text(data.buyer.name, 300)
        .text(data.buyer.email, 300)
        .text(`User ID: ${data.buyer.userId}`, 300);
      doc.x = 50;
      doc.moveDown(2);

      const rows: [string, string][] = [
        ['Item', `$P digital credits — $${data.packageUsd} package`],
        ['Payment method', 'Buy Me a Coffee (card payment)'],
        ['Buy Me a Coffee transaction', data.bmcTransactionRef],
        ['Payer email on Buy Me a Coffee', data.payerEmail ?? '—'],
        ['Amount received', formatUsd(data.receivedUsdCents)],
        ['Credits delivered', `${data.creditedP.toLocaleString('en-US')} $P`],
      ];
      const tableTop = doc.y;
      rows.forEach(([label, value], i) => {
        const y = tableTop + i * 26;
        if (i % 2 === 0) doc.rect(50, y - 6, 495, 26).fill('#f4f4f5');
        doc
          .font('bold')
          .fontSize(10)
          .fillColor('#18181b')
          .text(label, 60, y, { width: 200 });
        doc
          .font('regular')
          .fontSize(10)
          .fillColor('#18181b')
          .text(value, 270, y, { width: 270 });
      });
      doc.x = 50;
      doc.y = tableTop + rows.length * 26 + 16;

      doc
        .font('bold')
        .fontSize(12)
        .fillColor('#1d3557')
        .text(`Total paid: ${formatUsd(data.receivedUsdCents)}`, {
          align: 'right',
        });
      doc.moveDown(2);

      doc
        .font('regular')
        .fontSize(9)
        .fillColor('#71717a')
        .text(
          `The buyer accepted the terms "$P are digital credits for use on KHOMANGUON.ORG, delivered instantly upon confirmation, and are non-refundable" at ${formatUtc(data.termsAcceptedAt)}${data.termsIp ? ` from IP ${data.termsIp}` : ''}. The credits above were delivered to the buyer's wallet at ${formatUtc(data.approvedAt)}.`,
        );
      doc.end();
    });
  }
}
