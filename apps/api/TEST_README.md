# Y Monitor API - Testing Guide

Este guia detalha como executar e manter os testes automatizados do Y Monitor API.

## Estrutura de Testes

### Tipos de Testes

1. **Testes Unitários** (`*.spec.ts`)
   - Testam componentes individuais isoladamente
   - Localizados ao lado dos arquivos fonte
   - Executados com `npm run test:unit`

2. **Testes de Integração** (`*.e2e-spec.ts`)
   - Testam o funcionamento completo da API
   - Localizados na pasta `test/`
   - Executados com `npm run test:e2e`

### Cobertura de Testes

Os testes cobrem os seguintes módulos:

- **AuthService** - Autenticação e autorização
- **SensorsService** - Monitoramento de sensores ambientais
- **SNMPClientService** - Cliente SNMP para coleta de dados
- **InterfaceMonitoringService** - Monitoramento de interfaces de rede
- **InfluxDBService** - Integração com banco de dados de séries temporais

## Configuração do Ambiente de Teste

### Pré-requisitos

```bash
# Instalar dependências
npm install

# Configurar banco de dados de teste
npm run db:generate
```

### Variáveis de Ambiente

Crie um arquivo `.env.test` com as seguintes configurações:

```env
DATABASE_URL="postgresql://test:test@localhost:5432/ymonitor_test?schema=public"
JWT_SECRET="test-jwt-secret-key-for-testing-only"
REDIS_HOST="localhost"
REDIS_PORT=6379
INFLUXDB_URL="http://localhost:8086"
INFLUXDB_TOKEN="test-token"
INFLUXDB_ORG="test-org"
INFLUXDB_BUCKET="test-bucket"
NODE_ENV="test"
DISABLE_EXTERNAL_SERVICES=true
MOCK_SNMP_RESPONSES=true
MOCK_INFLUXDB=true
```

## Executando os Testes

### Comandos Disponíveis

```bash
# Executar todos os testes
npm run test:all

# Testes unitários apenas
npm run test:unit

# Testes de integração apenas
npm run test:e2e

# Testes com coverage
npm run test:cov

# Testes em modo watch
npm run test:watch

# Debug dos testes
npm run test:debug
```

### Executando Testes Específicos

```bash
# Testar apenas o AuthService
npm test -- auth.service.spec.ts

# Testar com padrão específico
npm test -- --testNamePattern="should login successfully"

# Executar testes em um arquivo específico
npm test src/sensors/sensors.service.spec.ts
```

## Estrutura dos Testes

### Exemplo de Teste Unitário

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should validate user credentials', async () => {
    // Arrange
    const email = 'test@example.com';
    const password = 'password123';
    
    // Act
    const result = await service.validateUser(email, password);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.email).toBe(email);
  });
});
```

### Exemplo de Teste de Integração

```typescript
describe('Authentication (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/login (POST)', async () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('access_token');
      });
  });
});
```

## Mocks e Fixtures

### Dados de Teste

Os testes utilizam mocks para simular dependências externas:

- **SNMP Client**: Simulado para evitar chamadas reais de rede
- **InfluxDB**: Mockado para testes de métricas
- **Prisma**: Utiliza dados fictícios em memória

### Utilitários de Teste

```typescript
// Mock factory para dispositivos
const mockDevice = {
  id: 'device-1',
  hostname: 'test-device',
  ip: '192.168.1.100',
  snmpVersion: 'v2c',
  snmpCommunity: 'public',
};

// Mock factory para sensores
const mockSensor = {
  id: 'sensor-1',
  deviceId: 'device-1',
  sensorType: 'TEMPERATURE',
  sensorDescr: 'CPU Temperature',
  value: 65.5,
};
```

## Coverage e Relatórios

### Configuração de Coverage

O Jest está configurado para gerar relatórios de coverage:

```json
{
  "collectCoverageFrom": [
    "**/*.(t|j)s",
    "!**/*.spec.ts",
    "!**/*.interface.ts",
    "!**/*.dto.ts"
  ],
  "coverageDirectory": "../coverage",
  "coverageReporters": ["html", "text", "lcov"]
}
```

### Métricas de Qualidade

Os testes devem manter:

- **Coverage de Linhas**: > 80%
- **Coverage de Funções**: > 85%
- **Coverage de Branches**: > 75%

## CI/CD Integration

### GitHub Actions

Os testes são executados automaticamente via GitHub Actions:

- **Pull Requests**: Todos os testes devem passar
- **Push para main**: Testes + deployment
- **Nightly**: Testes de performance e security audit

### Comandos de CI

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    npm run test:unit
    npm run test:e2e
    npm run test:cov
```

## Debugging

### VS Code Configuration

Adicione ao `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug de Testes Específicos

```bash
# Debug com breakpoints
npm run test:debug -- --testNamePattern="should login"

# Debug específico com inspector
node --inspect-brk node_modules/.bin/jest --runInBand auth.service.spec.ts
```

## Boas Práticas

### Estrutura de Teste

1. **Arrange**: Configurar dados e mocks
2. **Act**: Executar a função sendo testada
3. **Assert**: Verificar o resultado

### Nomenclatura

```typescript
// ✅ Bom
it('should return user when credentials are valid', () => {});

// ❌ Ruim
it('test login', () => {});
```

### Isolamento

- Cada teste deve ser independente
- Usar `beforeEach` para setup
- Usar `afterEach` para cleanup
- Mockar dependências externas

### Performance

- Evitar chamadas reais de rede/banco
- Usar mocks para operações custosas
- Paralelizar testes quando possível

## Troubleshooting

### Problemas Comuns

1. **Timeout nos testes**
   ```typescript
   jest.setTimeout(30000); // Aumentar timeout
   ```

2. **Mocks não funcionando**
   ```typescript
   jest.clearAllMocks(); // Limpar mocks entre testes
   ```

3. **Banco de dados não limpo**
   ```typescript
   beforeEach(async () => {
     await cleanupDatabase();
   });
   ```

### Logs de Debug

```typescript
// Habilitar logs durante testes
process.env.LOG_LEVEL = 'debug';
```

## Contribuindo

### Adicionando Novos Testes

1. Criar arquivo `*.spec.ts` ao lado do código
2. Seguir padrões estabelecidos
3. Garantir coverage adequado
4. Documentar casos complexos

### Review de Testes

- Verificar se testa comportamento, não implementação
- Confirmar casos de borda
- Validar mocks apropriados
- Checar performance dos testes

## Recursos Adicionais

- [Jest Documentation](https://jestjs.io/docs)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Supertest Documentation](https://github.com/visionmedia/supertest)