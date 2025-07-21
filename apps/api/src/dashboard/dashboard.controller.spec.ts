import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: DashboardService;

  const mockDashboardService = {
    getDashboardData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: mockDashboardService,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    dashboardService = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDashboardData', () => {
    it('should return dashboard data', async () => {
      const mockData = {
        devices: { total: 100, up: 95, down: 5 },
        alerts: { critical: 2, warning: 10, info: 25 },
        bandwidth: { inbound: 1000000, outbound: 800000 },
        recentAlerts: [],
        topDevices: [],
        networkPerformance: { utilization: 65.5 },
      };

      mockDashboardService.getDashboardData.mockResolvedValue(mockData);

      const result = await controller.getDashboardData();

      expect(result).toEqual(mockData);
      expect(dashboardService.getDashboardData).toHaveBeenCalledTimes(1);
    });
  });



});