import { Test, TestingModule } from '@nestjs/testing';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

describe('DevicesController', () => {
  let controller: DevicesController;
  let devicesService: DevicesService;

  const mockDevicesService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getStats: jest.fn(),
  };

  const mockDevice = {
    id: 'device-1',
    hostname: 'test-router',
    ip: '192.168.1.1',
    type: 'ROUTER',
    status: 'UP',
    snmpVersion: 'v2c',
    snmpCommunity: 'public',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DevicesController],
      providers: [
        {
          provide: DevicesService,
          useValue: mockDevicesService,
        },
      ],
    }).compile();

    controller = module.get<DevicesController>(DevicesController);
    devicesService = module.get<DevicesService>(DevicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of devices', async () => {
      const mockDevices = [mockDevice];
      mockDevicesService.findAll.mockResolvedValue(mockDevices);

      const result = await controller.findAll();

      expect(result).toEqual(mockDevices);
      expect(devicesService.findAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('should return a single device', async () => {
      mockDevicesService.findOne.mockResolvedValue(mockDevice);

      const result = await controller.findOne('device-1');

      expect(result).toEqual(mockDevice);
      expect(devicesService.findOne).toHaveBeenCalledWith('device-1');
    });
  });

  describe('getStats', () => {
    it('should return device statistics', async () => {
      const mockStats = {
        total: 100,
        up: 95,
        down: 5,
        warning: 3,
      };

      mockDevicesService.getStats.mockResolvedValue(mockStats);

      const result = await controller.getStats();

      expect(result).toEqual(mockStats);
      expect(devicesService.getStats).toHaveBeenCalledTimes(1);
    });
  });



});