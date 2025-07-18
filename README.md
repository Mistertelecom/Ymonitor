# Y MONITOR

> Modern Network Monitoring System

![Y Monitor](https://img.shields.io/badge/Y%20Monitor-v1.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?logo=postgresql&logoColor=white)

## 🎯 Overview

Y MONITOR é um sistema moderno de monitoramento de rede baseado no LibreNMS, desenvolvido com tecnologias atuais para oferecer melhor performance, escalabilidade e experiência do usuário.

### ✨ Key Features

- **Real-time Monitoring**: SNMP v1/v2c/v3 support with live dashboards
- **Device Auto-discovery**: Automatic network device detection and classification
- **Advanced Alerting**: Intelligent alerts with multiple notification channels
- **Network Topology**: Visual network mapping with geographic visualization
- **Performance Analytics**: Historical data analysis with predictive insights
- **Modern UI**: Responsive React-based interface with dark/light themes
- **Mobile Support**: Progressive Web App with mobile optimization
- **Enterprise Security**: JWT authentication, RBAC, 2FA support
- **Scalable Architecture**: Microservices with Docker/Kubernetes deployment

## 🏗️ Architecture

### Technology Stack

**Backend**
- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL + InfluxDB + Redis
- **Authentication**: JWT + Passport.js
- **Queue**: BullMQ + Redis
- **API**: REST + WebSocket
- **Documentation**: Swagger/OpenAPI

**Frontend**
- **Framework**: Next.js 14 + React 18
- **UI Library**: Tailwind CSS + Shadcn/ui
- **State Management**: Zustand + React Query
- **Charts**: Recharts + D3.js
- **Maps**: Mapbox GL JS
- **Forms**: React Hook Form + Zod

**Infrastructure**
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes
- **Monitoring**: Prometheus + Grafana
- **CI/CD**: GitHub Actions

### Project Structure

```
y-monitor/
├── apps/
│   ├── api/              # NestJS Backend API
│   ├── web/              # Next.js Frontend
│   ├── mobile/           # React Native App (planned)
│   └── docs/             # Documentation site (planned)
├── packages/
│   ├── shared/           # Shared utilities
│   ├── ui/               # UI component library
│   ├── types/            # TypeScript definitions
│   └── config/           # Shared configurations
├── tools/
│   ├── database/         # Database scripts
│   ├── deploy/           # Deployment scripts
│   └── monitoring/       # Monitoring configs
├── docker/               # Docker configurations
├── k8s/                  # Kubernetes manifests
├── scripts/              # Setup and utility scripts
└── librenms/             # Original LibreNMS reference
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Docker** & **Docker Compose** ([Download](https://www.docker.com/))
- **Git** ([Download](https://git-scm.com/))

### Automated Setup

#### Windows
```bash
# Run the setup script
scripts\setup-dev.bat
```

#### Linux/macOS
```bash
# Make script executable
chmod +x scripts/setup-dev.sh

# Run the setup script
./scripts/setup-dev.sh
```

### Manual Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd y-monitor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment files**
   ```bash
   # Backend API
   cp apps/api/.env.example apps/api/.env
   
   # Frontend Web
   cp apps/web/.env.example apps/web/.env.local
   
   # Root environment
   cp .env.example .env
   ```

4. **Start database services**
   ```bash
   npm run docker:dev
   ```

5. **Setup database**
   ```bash
   cd apps/api
   npm run db:generate
   npm run db:migrate
   cd ../..
   ```

6. **Start development servers**
   ```bash
   npm run dev
   ```

### Access Applications

- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API**: [http://localhost:3001](http://localhost:3001)
- **API Documentation**: [http://localhost:3001/api](http://localhost:3001/api)
- **Grafana**: [http://localhost:3030](http://localhost:3030) (admin/admin)
- **Prometheus**: [http://localhost:9090](http://localhost:9090)

## 🔧 Development

### Available Scripts

**Root level:**
- `npm run dev` - Start all development servers
- `npm run build` - Build all applications
- `npm run test` - Run all tests
- `npm run lint` - Lint all code
- `npm run format` - Format code with Prettier

**Docker commands:**
- `npm run docker:dev` - Start development containers
- `npm run docker:prod` - Start production containers
- `npm run docker:down` - Stop all containers

**Database:**
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### Environment Variables

#### Backend API (`apps/api/.env`)
```env
DATABASE_URL="postgresql://ymonitor:password@localhost:5432/ymonitor"
REDIS_URL="redis://localhost:6379"
INFLUXDB_URL=http://localhost:8086
JWT_SECRET=your-super-secret-jwt-key-here
PORT=3001
```

#### Frontend Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_MAPBOX_TOKEN=your-mapbox-access-token
```

### Database Schema

The application uses Prisma ORM with PostgreSQL. Key entities:

- **Users & Authentication**: User management with RBAC
- **Devices**: Network devices with SNMP configuration
- **Ports**: Network interfaces and statistics
- **Sensors**: Environmental and performance sensors
- **Alerts**: Alert rules and notifications
- **Locations**: Geographic device organization

## 📊 Features

### Core Monitoring

- ✅ **SNMP Monitoring**: Full v1/v2c/v3 support
- ✅ **Device Discovery**: Auto-detection of network devices
- ✅ **Port Monitoring**: Interface statistics and utilization
- ✅ **Service Checks**: HTTP, HTTPS, SSH, custom services
- ✅ **Sensor Monitoring**: Temperature, humidity, voltage, etc.

### Alerting & Notifications

- ✅ **Rule Engine**: Flexible SQL-like alert conditions
- ✅ **Multiple Channels**: Email, Slack, Teams, Discord, Telegram
- ✅ **Alert Scheduling**: Maintenance windows and escalation
- ✅ **Mobile Notifications**: Push notifications via PWA

### Visualization & Reporting

- ✅ **Real-time Dashboards**: Customizable widgets and charts
- ✅ **Network Topology**: Auto-discovered network maps
- ✅ **Geographic Maps**: GPS-based device visualization
- ✅ **Performance Graphs**: Historical data with zoom/pan
- ✅ **Availability Reports**: SLA reporting and analytics

### Administration

- ✅ **User Management**: RBAC with device-level permissions
- ✅ **Configuration**: Web-based system configuration
- ✅ **Audit Logging**: Complete activity tracking
- ✅ **Backup/Restore**: Database and configuration management

## 🔒 Security

- **Authentication**: JWT-based with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Session Management**: Secure session handling
- **Rate Limiting**: API rate limiting and DoS protection
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection**: Prisma ORM prevents SQL injection
- **XSS Protection**: React's built-in XSS protection
- **CORS**: Configurable cross-origin resource sharing

## 📈 Performance

- **Database**: Optimized queries with proper indexing
- **Caching**: Redis-based caching for frequently accessed data
- **Time Series**: InfluxDB for high-performance metrics storage
- **Background Jobs**: Queue-based processing for heavy tasks
- **API**: Efficient pagination and filtering
- **Frontend**: Code splitting and lazy loading

## 🚀 Deployment

### Development
```bash
npm run docker:dev
npm run dev
```

### Production
```bash
npm run build
npm run docker:prod
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

## 📖 Documentation

- [Migration Plan](./Y-MONITOR-MIGRATION-PLAN.md) - Complete migration strategy from LibreNMS
- [API Documentation](http://localhost:3001/api) - Interactive Swagger docs
- [Database Schema](./docs/database.md) - Detailed schema documentation
- [Development Guide](./docs/development.md) - Contribution guidelines
- [Deployment Guide](./docs/deployment.md) - Production deployment

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Use conventional commits
- Update documentation
- Ensure code passes linting

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [LibreNMS](https://github.com/librenms/librenms) - Original inspiration and reference implementation
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Next.js](https://nextjs.org/) - React framework for production
- [Prisma](https://prisma.io/) - Next-generation ORM
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/y-monitor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/y-monitor/discussions)
- **Documentation**: [Wiki](https://github.com/your-org/y-monitor/wiki)

---

**Y MONITOR** - Modern Network Monitoring for the Future 🚀

> For any implementation questions or technical details, always refer to the original LibreNMS code in `./librenms/` directory as the definitive reference.