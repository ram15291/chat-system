import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  const testUser = {
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    username: 'testuser',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/users');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/users/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/users/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('user-service');
      });
  });

  it('/api/users/auth/register (POST) - should register a new user', () => {
    return request(app.getHttpServer())
      .post('/api/users/auth/register')
      .send(testUser)
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).toHaveProperty('refresh_token');
        expect(res.body).toHaveProperty('user');
        expect(res.body.user.email).toBe(testUser.email);
        accessToken = res.body.access_token;
        refreshToken = res.body.refresh_token;
      });
  });

  it('/api/users/auth/register (POST) - should fail with duplicate email', () => {
    return request(app.getHttpServer())
      .post('/api/users/auth/register')
      .send(testUser)
      .expect(409);
  });

  it('/api/users/me (GET) - should get current user with valid token', () => {
    return request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe(testUser.email);
        expect(res.body.username).toBe(testUser.username);
        expect(res.body).not.toHaveProperty('password_hash');
      });
  });

  it('/api/users/me (GET) - should fail without token', () => {
    return request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('/api/users/auth/login (POST) - should login with correct credentials', () => {
    return request(app.getHttpServer())
      .post('/api/users/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('access_token');
        expect(res.body).toHaveProperty('refresh_token');
      });
  });

  it('/api/users/auth/login (POST) - should fail with wrong password', () => {
    return request(app.getHttpServer())
      .post('/api/users/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      })
      .expect(401);
  });

  it('/api/users/auth/refresh (POST) - should refresh access token', () => {
    return request(app.getHttpServer())
      .post('/api/users/auth/refresh')
      .send({
        refresh_token: refreshToken,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('access_token');
        expect(res.body.token_type).toBe('Bearer');
      });
  });

  it('/api/users/auth/logout (POST) - should logout user', () => {
    return request(app.getHttpServer())
      .post('/api/users/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        refresh_token: refreshToken,
      })
      .expect(200);
  });
});
