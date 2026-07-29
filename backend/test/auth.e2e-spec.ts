import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
  user: { id: string; email: string; emailVerified: boolean };
}

interface MeResponseBody {
  email: string;
  roles: string[];
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-auth-${Date.now()}@khomanguon.local`;
  const password = 'Password123!';

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('đăng ký -> nhận access token, gán role member mặc định', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'E2E Tester' })
      .expect(201);

    const body = res.body as AuthResponseBody;
    expect(body.accessToken).toBeDefined();
    expect(body.user.email).toBe(email);
    expect(body.user.emailVerified).toBe(false);
    expect(res.headers['set-cookie']?.[0]).toMatch(/refresh_token=/);
  });

  it('đăng ký trùng email -> 409', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password, displayName: 'E2E Tester 2' })
      .expect(409);
  });

  it('/users/me không có token -> 401', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('đăng nhập đúng mật khẩu -> lấy được /users/me, role = member', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const { accessToken } = loginRes.body as AuthResponseBody;

    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const me = meRes.body as MeResponseBody;

    expect(me.email).toBe(email);
    expect(me.roles).toEqual(['member']);
  });

  it('đăng nhập sai mật khẩu -> 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'sai-mat-khau' })
      .expect(401);
  });

  it('refresh token cookie -> cấp access token mới, cookie cũ bị thu hồi', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const cookie = (loginRes.headers['set-cookie'] as unknown as string[])[0];

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(200);
    expect((refreshRes.body as AuthResponseBody).accessToken).toBeDefined();

    // Cookie refresh cũ đã bị rotate/thu hồi — dùng lại phải thất bại
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('member gọi endpoint cần quyền user.manage -> 403', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const { accessToken } = loginRes.body as AuthResponseBody;

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });
});
