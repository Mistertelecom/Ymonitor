import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return health status when database is connected', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await controller.getHealth();

      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toEqual(expect.any(Number));
      expect(result.database.status).toBe('connected');
      expect(result.memory).toBeDefined();
      expect(prismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should return error status when database is disconnected', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.getHealth();

      expect(result.status).toBe('error');
      expect(result.error).toBe('Database connection failed');
      expect(result.database.status).toBe('disconnected');
    });
  });

  describe('getReadiness', () => {
    it('should return ready status when database is available', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await controller.getReadiness();

      expect(result).toEqual({ status: 'ready' });
      expect(prismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should return not ready status when database is unavailable', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      const result = await controller.getReadiness();

      expect(result).toEqual({
        status: 'not ready',
        reason: 'Database unavailable',
      });
    });
  });

  describe('getLiveness', () => {
    it('should return liveness status', () => {
      const result = controller.getLiveness();
      
      expect(result.status).toBe('alive');
      expect(result.timestamp).toBeDefined();
    });
  });
});