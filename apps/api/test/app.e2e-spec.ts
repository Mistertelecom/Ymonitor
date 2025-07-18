import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Y Monitor API (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let authToken: string;

  const testUser = {
    email: 'test@example.com',
    username: 'testuser',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
  };

  const testDevice = {
    hostname: 'test-device',
    ip: '192.168.1.100',
    snmpVersion: 'v2c',
    snmpCommunity: 'public',
    status: 'UP',
    sysName: 'Test Device',
    sysDescr: 'Test Device Description',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();

    // Clean up test data
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function cleanupTestData() {
    // Clean up in correct order due to foreign key constraints
    await prismaService.alert.deleteMany({
      where: { deviceId: { contains: 'test' } },
    });
    
    await prismaService.sensor.deleteMany({
      where: { deviceId: { contains: 'test' } },
    });
    
    await prismaService.port.deleteMany({
      where: { deviceId: { contains: 'test' } },
    });
    
    await prismaService.device.deleteMany({
      where: { hostname: { contains: 'test' } },
    });
    
    await prismaService.userSession.deleteMany({
      where: { user: { email: testUser.email } },
    });
    
    await prismaService.user.deleteMany({
      where: { email: testUser.email },
    });
  }

  describe('Authentication', () => {
    it('/auth/register (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.username).toBe(testUser.username);
      expect(response.body).not.toHaveProperty('password');
    });

    it('/auth/login (POST)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);

      authToken = response.body.access_token;
    });

    it('/auth/profile (GET) - should require authentication', async () => {
      await request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('/auth/profile (GET) - should return user profile when authenticated', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.email).toBe(testUser.email);
      expect(response.body.username).toBe(testUser.username);
    });

    it('/auth/logout (POST)', async () => {
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('Devices', () => {
    beforeEach(async () => {
      // Re-authenticate for device tests
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        });
      authToken = loginResponse.body.access_token;
    });

    it('/devices (POST) - should create a new device', async () => {
      const response = await request(app.getHttpServer())
        .post('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testDevice)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.hostname).toBe(testDevice.hostname);
      expect(response.body.ip).toBe(testDevice.ip);
    });

    it('/devices (GET) - should return list of devices', async () => {
      const response = await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const device = response.body.find(d => d.hostname === testDevice.hostname);
      expect(device).toBeDefined();
    });

    it('/devices/:id (GET) - should return specific device', async () => {
      // First create a device
      const createResponse = await request(app.getHttpServer())
        .post('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testDevice, hostname: 'test-device-2' });

      const deviceId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/devices/${deviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(deviceId);
      expect(response.body.hostname).toBe('test-device-2');
    });

    it('/devices/:id (PUT) - should update device', async () => {
      // First create a device
      const createResponse = await request(app.getHttpServer())
        .post('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testDevice, hostname: 'test-device-3' });

      const deviceId = createResponse.body.id;

      const updateData = {
        hostname: 'updated-test-device',
        sysLocation: 'Data Center A',
      };

      const response = await request(app.getHttpServer())
        .put(`/devices/${deviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.hostname).toBe(updateData.hostname);
      expect(response.body.sysLocation).toBe(updateData.sysLocation);
    });

    it('/devices/:id (DELETE) - should delete device', async () => {
      // First create a device
      const createResponse = await request(app.getHttpServer())
        .post('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testDevice, hostname: 'test-device-to-delete' });

      const deviceId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/devices/${deviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify device is deleted
      await request(app.getHttpServer())
        .get(`/devices/${deviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('Discovery', () => {
    let deviceId: string;

    beforeEach(async () => {
      // Re-authenticate for discovery tests
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        });
      authToken = loginResponse.body.access_token;

      // Create a test device
      const deviceResponse = await request(app.getHttpServer())
        .post('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testDevice, hostname: 'discovery-test-device' });
      
      deviceId = deviceResponse.body.id;
    });

    it('/discovery/device/:id (POST) - should initiate device discovery', async () => {
      const response = await request(app.getHttpServer())
        .post(`/discovery/device/${deviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('discovery initiated');
    });

    it('/discovery/network (POST) - should initiate network discovery', async () => {
      const discoveryData = {
        network: '192.168.1.0/24',
        snmpCommunity: 'public',
        snmpVersion: 'v2c',
      };

      const response = await request(app.getHttpServer())
        .post('/discovery/network')
        .set('Authorization', `Bearer ${authToken}`)
        .send(discoveryData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Network discovery initiated');
    });
  });

  describe('Sensors', () => {
    let deviceId: string;

    beforeEach(async () => {
      // Re-authenticate for sensor tests
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        });
      authToken = loginResponse.body.access_token;

      // Create a test device
      const deviceResponse = await request(app.getHttpServer())
        .post('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...testDevice, hostname: 'sensor-test-device' });
      
      deviceId = deviceResponse.body.id;
    });

    it('/sensors/device/:deviceId (GET) - should return device sensors', async () => {
      const response = await request(app.getHttpServer())
        .get(`/sensors/device/${deviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('/sensors/discover/:deviceId (POST) - should initiate sensor discovery', async () => {
      const response = await request(app.getHttpServer())
        .post(`/sensors/discover/${deviceId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Sensor discovery initiated');
    });
  });

  describe('Dashboard', () => {
    beforeEach(async () => {
      // Re-authenticate for dashboard tests
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        });
      authToken = loginResponse.body.access_token;
    });

    it('/dashboard/stats (GET) - should return dashboard statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalDevices');
      expect(response.body).toHaveProperty('activeDevices');
      expect(response.body).toHaveProperty('totalAlerts');
      expect(response.body).toHaveProperty('criticalAlerts');
      expect(response.body).toHaveProperty('totalUsers');
      expect(response.body).toHaveProperty('networkUtilization');
    });

    it('/dashboard/devices (GET) - should return recent devices', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('/dashboard/alerts (GET) - should return recent alerts', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Alerts', () => {
    beforeEach(async () => {
      // Re-authenticate for alert tests
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        });
      authToken = loginResponse.body.access_token;
    });

    it('/alerts (GET) - should return list of alerts', async () => {
      const response = await request(app.getHttpServer())
        .get('/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('/alerts (GET) - should support filtering by severity', async () => {
      const response = await request(app.getHttpServer())
        .get('/alerts?severity=CRITICAL')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(alert => {
        if (alert.severity) {
          expect(alert.severity).toBe('CRITICAL');
        }
      });
    });

    it('/alerts (GET) - should support filtering by state', async () => {
      const response = await request(app.getHttpServer())
        .get('/alerts?state=ACTIVE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(alert => {
        if (alert.state) {
          expect(alert.state).toBe('ACTIVE');
        }
      });
    });
  });

  describe('Health Check', () => {
    it('/health (GET) - should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('details');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      // Re-authenticate for error handling tests
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        });
      authToken = loginResponse.body.access_token;
    });

    it('should return 404 for non-existent device', async () => {
      await request(app.getHttpServer())
        .get('/devices/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 400 for invalid device data', async () => {
      const invalidDevice = {
        hostname: '', // Empty hostname should be invalid
        ip: 'invalid-ip',
      };

      await request(app.getHttpServer())
        .post('/devices')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDevice)
        .expect(400);
    });

    it('should return 401 for requests without authentication', async () => {
      await request(app.getHttpServer())
        .get('/devices')
        .expect(401);
    });

    it('should return 401 for requests with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/devices')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      const requests = [];
      
      // Make multiple rapid requests to test rate limiting
      for (let i = 0; i < 110; i++) {
        requests.push(
          request(app.getHttpServer())
            .post('/auth/login')
            .send({
              email: 'nonexistent@example.com',
              password: 'wrongpassword',
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});