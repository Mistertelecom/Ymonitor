import { Test, TestingModule } from '@nestjs/testing';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';

describe('SensorsController', () => {
  let controller: SensorsController;
  let sensorsService: SensorsService;

  const mockSensorsService = {
    getDeviceSensors: jest.fn(),
    getSensorHistory: jest.fn(),
    discoverSensors: jest.fn(),
  };

  const mockSensor = {
    id: 'sensor-1',
    deviceId: 'device-1',
    sensorType: 'TEMPERATURE',
    sensorDescr: 'CPU Temperature',
    value: 65,
    unit: '°C',
    timestamp: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SensorsController],
      providers: [
        {
          provide: SensorsService,
          useValue: mockSensorsService,
        },
      ],
    }).compile();

    controller = module.get<SensorsController>(SensorsController);
    sensorsService = module.get<SensorsService>(SensorsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getDeviceSensors', () => {
    it('should return sensors for a specific device', async () => {
      const mockSensors = [mockSensor];
      mockSensorsService.getDeviceSensors.mockResolvedValue(mockSensors);

      const result = await controller.getDeviceSensors('device-1');

      expect(result).toEqual(mockSensors);
      expect(sensorsService.getDeviceSensors).toHaveBeenCalledWith('device-1');
    });
  });

  describe('getSensorHistory', () => {
    it('should return sensor history with default 24 hours', async () => {
      const mockHistory = [
        { timestamp: new Date(), value: 65 },
        { timestamp: new Date(), value: 67 },
      ];

      mockSensorsService.getSensorHistory.mockResolvedValue(mockHistory);

      const result = await controller.getSensorHistory('device-1', 'sensor-1');

      expect(result).toEqual(mockHistory);
      expect(sensorsService.getSensorHistory).toHaveBeenCalledWith('device-1', 'sensor-1', 24);
    });

    it('should return sensor history with custom hours', async () => {
      const mockHistory = [
        { timestamp: new Date(), value: 65 },
        { timestamp: new Date(), value: 67 },
      ];

      mockSensorsService.getSensorHistory.mockResolvedValue(mockHistory);

      const result = await controller.getSensorHistory('device-1', 'sensor-1', '12');

      expect(result).toEqual(mockHistory);
      expect(sensorsService.getSensorHistory).toHaveBeenCalledWith('device-1', 'sensor-1', 12);
    });
  });

  describe('discoverSensors', () => {
    it('should initiate sensor discovery for a device', async () => {
      mockSensorsService.discoverSensors.mockResolvedValue(undefined);

      const result = await controller.discoverSensors('device-1');

      expect(result).toEqual({ message: 'Sensor discovery initiated' });
      expect(sensorsService.discoverSensors).toHaveBeenCalledWith('device-1');
    });
  });

});