import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UserRole } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashedpassword',
    firstName: 'Test',
    lastName: 'User',
    role: 'USER',
    isActive: true,
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('password123', 12);
      const userWithHashedPassword = { ...mockUser, password: hashedPassword };
      
      mockPrismaService.user.findUnique.mockResolvedValue(userWithHashedPassword);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role,
        isActive: mockUser.isActive,
      });
      expect(result.password).toBeUndefined();
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockPrismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(
        service.validateUser('test@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is invalid', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      const userWithHashedPassword = { ...mockUser, password: hashedPassword };
      
      mockPrismaService.user.findUnique.mockResolvedValue(userWithHashedPassword);

      await expect(
        service.validateUser('test@example.com', 'wrongpassword')
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return access token and user data when login is successful', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
        userAgent: 'Test Browser',
        ipAddress: '127.0.0.1',
      };

      const hashedPassword = await bcrypt.hash('password123', 12);
      const userWithHashedPassword = { ...mockUser, password: hashedPassword };
      
      mockPrismaService.user.findUnique.mockResolvedValue(userWithHashedPassword);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockPrismaService.userSession.create.mockResolvedValue({
        id: 'session-1',
        token: 'jwt-token',
      });
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        access_token: 'jwt-token',
        token_type: 'Bearer',
        expires_in: 7 * 24 * 60 * 60,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
          role: mockUser.role,
        },
      });
    });
  });

  describe('register', () => {
    it('should create a new user when data is valid', async () => {
      const createUserDto: CreateUserDto = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        role: UserRole.USER,
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: createUserDto.email,
        username: createUserDto.username,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role,
        createdAt: new Date(),
      });

      const result = await service.register(createUserDto);

      expect(result.email).toBe(createUserDto.email);
      expect(result.username).toBe(createUserDto.username);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: createUserDto.email,
          username: createUserDto.username,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          role: createUserDto.role,
          password: expect.any(String),
        }),
        select: expect.any(Object),
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        username: 'newuser',
        password: 'password123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue({
        email: 'existing@example.com',
      });

      await expect(service.register(createUserDto)).rejects.toThrow(
        ConflictException
      );
    });

    it('should throw ConflictException when username already exists', async () => {
      const createUserDto: CreateUserDto = {
        email: 'newuser@example.com',
        username: 'existinguser',
        password: 'password123',
      };

      mockPrismaService.user.findFirst.mockResolvedValue({
        username: 'existinguser',
      });

      await expect(service.register(createUserDto)).rejects.toThrow(
        ConflictException
      );
    });
  });

  describe('logout', () => {
    it('should delete user session', async () => {
      mockPrismaService.userSession.delete.mockResolvedValue({});

      const result = await service.logout('jwt-token');

      expect(result).toEqual({ message: 'Logged out successfully' });
      expect(mockPrismaService.userSession.delete).toHaveBeenCalledWith({
        where: { token: 'jwt-token' },
      });
    });

    it('should return success message even if token does not exist', async () => {
      mockPrismaService.userSession.delete.mockRejectedValue(new Error('Not found'));

      const result = await service.logout('invalid-token');

      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const hashedPassword = await bcrypt.hash('oldpassword', 12);
      const userWithHashedPassword = { ...mockUser, password: hashedPassword };
      
      mockPrismaService.user.findUnique.mockResolvedValue(userWithHashedPassword);
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.userSession.deleteMany.mockResolvedValue({});

      const result = await service.changePassword(
        'user-1',
        'oldpassword',
        'newpassword123'
      );

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: expect.any(String) },
      });
      expect(mockPrismaService.userSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });
});