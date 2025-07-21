import { Test, TestingModule } from '@nestjs/testing';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

describe('AlertsController', () => {
  let controller: AlertsController;
  let alertsService: AlertsService;

  const mockAlertsService = {
    findAll: jest.fn(),
    findActive: jest.fn(),
    getStats: jest.fn(),
    acknowledge: jest.fn(),
    resolve: jest.fn(),
  };

  const mockAlert = {
    id: 'alert-1',
    ruleId: 'rule-1',
    deviceId: 'device-1',
    severity: 'critical',
    state: 'open',
    message: 'Device is down',
    timestamp: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        {
          provide: AlertsService,
          useValue: mockAlertsService,
        },
      ],
    }).compile();

    controller = module.get<AlertsController>(AlertsController);
    alertsService = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of alerts', async () => {
      const mockAlerts = [mockAlert];
      mockAlertsService.findAll.mockResolvedValue(mockAlerts);

      const result = await controller.findAll();

      expect(result).toEqual(mockAlerts);
      expect(alertsService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findActive', () => {
    it('should return active alerts', async () => {
      const mockActiveAlerts = [mockAlert];
      mockAlertsService.findActive.mockResolvedValue(mockActiveAlerts);

      const result = await controller.findActive();

      expect(result).toEqual(mockActiveAlerts);
      expect(alertsService.findActive).toHaveBeenCalledTimes(1);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge an alert', async () => {
      const mockRequest = { user: { sub: 'user-1' } };
      const acknowledgedAlert = { ...mockAlert, state: 'acknowledged', ackBy: 'user-1' };
      
      mockAlertsService.acknowledge.mockResolvedValue(acknowledgedAlert);

      const result = await controller.acknowledge('alert-1', mockRequest, 'Working on it');

      expect(result).toEqual(acknowledgedAlert);
      expect(alertsService.acknowledge).toHaveBeenCalledWith('alert-1', 'user-1', 'Working on it');
    });
  });

  describe('resolve', () => {
    it('should resolve an alert', async () => {
      const resolvedAlert = { ...mockAlert, state: 'resolved' };
      
      mockAlertsService.resolve.mockResolvedValue(resolvedAlert);

      const result = await controller.resolve('alert-1');

      expect(result).toEqual(resolvedAlert);
      expect(alertsService.resolve).toHaveBeenCalledWith('alert-1');
    });
  });

  describe('getStats', () => {
    it('should return alert statistics', async () => {
      const mockStats = {
        total: 100,
        open: 15,
        acknowledged: 5,
        resolved: 80,
        critical: 2,
        warning: 8,
        info: 5,
      };

      mockAlertsService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
      expect(alertsService.getStats).toHaveBeenCalledTimes(1);
    });
  });
});