import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SubscriptionService } from '../src/subscriptions/subscription.service';
import { encryptSecret } from '../src/common/secret-crypto.util';
import {
  SEPAY_SECRET_CONTEXT,
  SEPAY_SETTING_KEY,
} from '../src/sepay/sepay-config.types';

interface AuthResponseBody {
  accessToken: string;
  user: { id: string; email: string };
}

interface SubscriptionOrderBody {
  order: { id: string; code: string; amountVnd: number; status: string };
  qrUrl: string;
}

const WEBHOOK_API_KEY = 'e2e-test-webhook-key';

// Cùng pattern auth.e2e-spec.ts — app thật (AppModule đầy đủ), Postgres thật (CI dùng ephemeral
// Postgres service), dọn dữ liệu theo email/id duy nhất trong afterAll thay vì wipe cả DB.
//
// QUAN TRỌNG: test này KHÔNG được phép làm gãy luồng nạp $P hiện có — mục "Regression: luồng nạp
// $P hiện có" bên dưới xác nhận trực tiếp bằng webhook thật, không chỉ suy luận từ code.
describe('Subscription (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let subscriptionService: SubscriptionService;

  const email = `e2e-subscription-${Date.now()}@khomanguon.local`;
  const password = 'Password123!';
  let userId: string;
  let accessToken: string;
  let planId: string;
  let storageProviderId: string;
  let postId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    subscriptionService = app.get(SubscriptionService);

    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'E2E Subscription' })
      .expect(201);
    const registerBody = registerRes.body as AuthResponseBody;
    userId = registerBody.user.id;
    accessToken = registerBody.accessToken;

    // Cấu hình SePay tối thiểu để createOrder() không bị chặn bởi "chưa cấu hình STK" — webhookApiKey
    // mã hoá bằng STORAGE_SECRET_KEY (CI đã set, xem .github/workflows/ci.yml) để test được cả bước
    // xác thực webhook thật, không chỉ gọi thẳng service bỏ qua tầng HTTP.
    await prisma.siteSetting.upsert({
      where: { key: SEPAY_SETTING_KEY },
      update: {
        value: {
          bankAccountNumber: '0123456789',
          bankName: 'Vietcombank',
          accountHolderName: 'E2E TEST',
          webhookApiKeyEncrypted: encryptSecret(
            WEBHOOK_API_KEY,
            SEPAY_SECRET_CONTEXT,
          ),
          apiAccessTokenEncrypted: null,
          baseRateVndPerP: 100,
          presets: [],
        },
      },
      create: {
        key: SEPAY_SETTING_KEY,
        value: {
          bankAccountNumber: '0123456789',
          bankName: 'Vietcombank',
          accountHolderName: 'E2E TEST',
          webhookApiKeyEncrypted: encryptSecret(
            WEBHOOK_API_KEY,
            SEPAY_SECRET_CONTEXT,
          ),
          apiAccessTokenEncrypted: null,
          baseRateVndPerP: 100,
          presets: [],
        },
      },
    });

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: 'E2E Test Plan',
        durationDays: 1,
        priceVnd: 321000,
        totalDownloadLimit: 2,
        dailyDownloadLimit: null,
        isActive: true,
      },
    });
    planId = plan.id;

    // Fixture tối thiểu cho phần test quota tải — không dùng để gọi unlock() HTTP thật (cần R2/S3
    // thật, ngoài phạm vi CI), chỉ để DownloadEvent có FK hợp lệ khi test trực tiếp
    // checkFreeDownloadEligibility() qua PrismaService thật (xác nhận query distinct/theo ngày chạy
    // đúng trên Postgres thật, việc mock ở subscription.service.spec.ts không xác nhận được).
    const provider = await prisma.storageProvider.create({
      data: {
        type: 'R2',
        label: 'E2E dummy provider',
        accessKeyId: 'dummy',
        secretAccessKeyEncrypted: 'dummy-not-real-encrypted-value',
      },
    });
    storageProviderId = provider.id;

    const post = await prisma.post.create({
      data: {
        title: 'E2E Subscription Post',
        slug: `e2e-subscription-post-${Date.now()}`,
        contentHtml: '<p>test</p>',
        authorId: userId,
      },
    });
    postId = post.id;
  });

  afterAll(async () => {
    await prisma.downloadEvent.deleteMany({ where: { userId } });
    await prisma.downloadLink.deleteMany({ where: { postId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.storageProvider.deleteMany({
      where: { id: storageProviderId },
    });
    await prisma.subscriptionMembership.deleteMany({ where: { userId } });
    await prisma.subscriptionSepayTransaction
      .deleteMany({ where: { subscriptionOrderId: { not: null } } })
      .catch(() => {});
    await prisma.subscriptionOrder.deleteMany({ where: { userId } });
    await prisma.subscriptionPlan.deleteMany({ where: { id: planId } });
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.wallet.deleteMany({ where: { userId } });
    await prisma.topupOrder.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  // ───────────────────────── Tạo đơn mua gói ─────────────────────────

  let orderId: string;
  let orderCode: string;

  it('POST /subscriptions/orders -> tạo đơn PENDING, mã bắt đầu "SUB", có QR', async () => {
    const res = await request(app.getHttpServer())
      .post('/subscriptions/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId })
      .expect(201);
    const body = res.body as SubscriptionOrderBody;

    expect(body.order.code).toMatch(/^SUB\d{6}$/);
    expect(body.order.amountVnd).toBe(321000);
    expect(body.order.status).toBe('PENDING');
    expect(body.qrUrl).toContain('vietqr.app');

    orderId = body.order.id;
    orderCode = body.order.code;
  });

  it('mua gói với planId không tồn tại -> 404', async () => {
    await request(app.getHttpServer())
      .post('/subscriptions/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ planId: 'khong-ton-tai' })
      .expect(404);
  });

  it('GET /subscriptions/orders/:id không có token -> 401', async () => {
    await request(app.getHttpServer())
      .get(`/subscriptions/orders/${orderId}`)
      .expect(401);
  });

  it('GET /subscriptions/orders/:id bằng user KHÁC -> 403 (không xem được đơn người khác)', async () => {
    const otherEmail = `e2e-subscription-other-${Date.now()}@khomanguon.local`;
    const otherRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: otherEmail, password, displayName: 'Other' })
      .expect(201);
    const otherToken = (otherRes.body as AuthResponseBody).accessToken;

    await request(app.getHttpServer())
      .get(`/subscriptions/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await prisma.user.deleteMany({ where: { email: otherEmail } });
  });

  // ───────────────────────── Webhook kích hoạt ─────────────────────────

  it('GET /subscriptions/me trước khi thanh toán -> null (chưa có gói nào)', async () => {
    const res = await request(app.getHttpServer())
      .get('/subscriptions/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toBeNull();
  });

  it('webhook SePay sai Apikey -> 401, không kích hoạt', async () => {
    await request(app.getHttpServer())
      .post('/sepay/webhook')
      .set('Authorization', 'Apikey sai-key-roi')
      .send({
        id: Date.now(),
        transferType: 'in',
        transferAmount: 321000,
        content: `CK ${orderCode} thanh toan`,
      })
      .expect(401);

    const order = await prisma.subscriptionOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe('PENDING');
  });

  const sepayTransactionId = Date.now();

  it('webhook SePay đúng Apikey + đúng nội dung/số tiền -> kích hoạt gói thật (Postgres thật, không mock)', async () => {
    await request(app.getHttpServer())
      .post('/sepay/webhook')
      .set('Authorization', `Apikey ${WEBHOOK_API_KEY}`)
      .send({
        id: sepayTransactionId,
        gateway: 'Vietcombank',
        transferType: 'in',
        transferAmount: 321000,
        content: `CK ${orderCode} thanh toan don hang`,
      })
      .expect(200, { success: true });

    const order = await prisma.subscriptionOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(order.status).toBe('SUCCESS');

    const membership = await prisma.subscriptionMembership.findFirstOrThrow({
      where: { userId, status: 'ACTIVE' },
    });
    expect(membership.planId).toBe(planId);
    expect(membership.endsAt.getTime()).toBeGreaterThan(Date.now());

    const hasRole = await prisma.userRole.findFirst({
      where: { userId, role: { slug: 'subscription' } },
    });
    expect(hasRole).not.toBeNull();
  });

  it('GET /subscriptions/me sau khi thanh toán -> trả đúng gói vừa mua', async () => {
    const res = await request(app.getHttpServer())
      .get('/subscriptions/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({
      plan: { id: planId, name: 'E2E Test Plan' },
    });
  });

  it('webhook gọi lại TRÙNG (SePay retry) -> vẫn 200, KHÔNG tạo thêm membership thứ 2 (idempotent)', async () => {
    await request(app.getHttpServer())
      .post('/sepay/webhook')
      .set('Authorization', `Apikey ${WEBHOOK_API_KEY}`)
      .send({
        id: sepayTransactionId, // CÙNG id giao dịch như lần trước
        gateway: 'Vietcombank',
        transferType: 'in',
        transferAmount: 321000,
        content: `CK ${orderCode} thanh toan don hang`,
      })
      .expect(200, { success: true });

    const count = await prisma.subscriptionMembership.count({
      where: { userId },
    });
    expect(count).toBe(1); // vẫn chỉ 1 membership, không bị tạo trùng
  });

  // ───────────────────────── Regression: luồng nạp $P hiện có KHÔNG bị ảnh hưởng ─────────────────────────

  it('luồng nạp $P (TopupOrder) qua CÙNG endpoint webhook vẫn hoạt động bình thường sau khi thêm Subscription', async () => {
    const topupOrder = await prisma.topupOrder.create({
      data: {
        userId,
        code: `GD${Math.floor(100000 + Math.random() * 900000)}`,
        amountVnd: 50000,
        amountP: 500,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    const walletBefore = await prisma.wallet.findUnique({ where: { userId } });
    const balanceBefore = walletBefore?.balance ?? 0;

    await request(app.getHttpServer())
      .post('/sepay/webhook')
      .set('Authorization', `Apikey ${WEBHOOK_API_KEY}`)
      .send({
        id: Date.now() + 1,
        gateway: 'Vietcombank',
        transferType: 'in',
        transferAmount: 50000,
        content: `CK ${topupOrder.code} nap tien`,
      })
      .expect(200, { success: true });

    const updatedOrder = await prisma.topupOrder.findUniqueOrThrow({
      where: { id: topupOrder.id },
    });
    expect(updatedOrder.status).toBe('SUCCESS');

    const walletAfter = await prisma.wallet.findUniqueOrThrow({
      where: { userId },
    });
    expect(walletAfter.balance).toBe(balanceBefore + 500);

    // Webhook nạp $P không được tạo nhầm SubscriptionMembership/SubscriptionOrder nào.
    const subOrderCount = await prisma.subscriptionOrder.count({
      where: { userId, code: { not: orderCode } },
    });
    expect(subOrderCount).toBe(0);
  });

  // ───────────────────────── Quota tải (đọc thẳng Postgres thật) ─────────────────────────

  describe('checkFreeDownloadEligibility — quota thật trên Postgres (không mock)', () => {
    let membershipId: string;
    let linkAId: string;
    let linkBId: string;
    let linkCId: string;

    beforeAll(async () => {
      const membership = await prisma.subscriptionMembership.findFirstOrThrow({
        where: { userId, status: 'ACTIVE' },
      });
      membershipId = membership.id;

      const [linkA, linkB, linkC] = await Promise.all([
        prisma.downloadLink.create({
          data: { postId, label: 'A', storageProviderId, objectKey: 'a.zip' },
        }),
        prisma.downloadLink.create({
          data: { postId, label: 'B', storageProviderId, objectKey: 'b.zip' },
        }),
        prisma.downloadLink.create({
          data: { postId, label: 'C', storageProviderId, objectKey: 'c.zip' },
        }),
      ]);
      linkAId = linkA.id;
      linkBId = linkB.id;
      linkCId = linkC.id;
    });

    it('chưa tải link nào -> eligible cho link A (plan giới hạn tổng 2 link)', async () => {
      const result = await subscriptionService.checkFreeDownloadEligibility(
        userId,
        linkAId,
      );
      expect(result).toEqual({ eligible: true, membershipId });
    });

    it('sau khi tải A + B (đủ 2/2 quota tổng) -> link C mới KHÔNG eligible', async () => {
      await prisma.downloadEvent.create({
        data: {
          userId,
          downloadLinkId: linkAId,
          ipAddress: '1.1.1.1',
          subscriptionMembershipId: membershipId,
        },
      });
      await prisma.downloadEvent.create({
        data: {
          userId,
          downloadLinkId: linkBId,
          ipAddress: '1.1.1.1',
          subscriptionMembershipId: membershipId,
        },
      });

      const resultC = await subscriptionService.checkFreeDownloadEligibility(
        userId,
        linkCId,
      );
      expect(resultC).toEqual({ eligible: false });
    });

    it('link A ĐÃ tải trước đó vẫn eligible để tải lại (không tính thêm vào quota dù đã hết quota)', async () => {
      const resultA = await subscriptionService.checkFreeDownloadEligibility(
        userId,
        linkAId,
      );
      expect(resultA).toEqual({ eligible: true, membershipId });
    });
  });

  // ───────────────────────── Cron hết hạn ─────────────────────────

  it('expireEndedMemberships() — hết hạn thật trên Postgres -> EXPIRED + gỡ role subscription', async () => {
    // Ép membership hết hạn ngay (không đợi thật 1 ngày).
    await prisma.subscriptionMembership.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { endsAt: new Date(Date.now() - 1000) },
    });

    const count = await subscriptionService.expireEndedMemberships();
    expect(count).toBeGreaterThanOrEqual(1);

    const membership = await prisma.subscriptionMembership.findFirstOrThrow({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(membership.status).toBe('EXPIRED');

    const hasRole = await prisma.userRole.findFirst({
      where: { userId, role: { slug: 'subscription' } },
    });
    expect(hasRole).toBeNull();

    // Quota cũng phải hết hiệu lực theo — không còn membership ACTIVE nào để tải free nữa.
    const eligibility = await subscriptionService.checkFreeDownloadEligibility(
      userId,
      'bat-ky-link-nao',
    );
    expect(eligibility).toEqual({ eligible: false });
  });
});
