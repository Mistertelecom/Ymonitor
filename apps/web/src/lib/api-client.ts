/**
 * Centralized API client for Y Monitor
 * Provides consistent error handling, authentication, and request/response transformation
 */

// Types
export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

// Custom error class
class ApiClientError extends Error implements ApiError {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504]
};

// Main API client class
class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private retryConfig: RetryConfig;

  constructor(config: {
    baseURL?: string;
    timeout?: number;
    retryConfig?: Partial<RetryConfig>;
  } = {}) {
    this.baseURL = config.baseURL || API_BASE_URL;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  // Add authentication headers
  private getAuthHeaders(authHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      ...this.defaultHeaders,
      ...authHeaders,
    };
  }

  // Enhanced error handling
  private handleError(error: unknown, url: string, method: string): never {
    if (error instanceof Response) {
      throw new ApiClientError(
        `HTTP ${error.status}: ${error.statusText}`,
        error.status,
        'HTTP_ERROR',
        { url, method }
      );
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiClientError(
        'Network error: Unable to connect to server',
        0,
        'NETWORK_ERROR',
        { url, method }
      );
    }

    if (error instanceof Error) {
      throw new ApiClientError(
        error.message,
        undefined,
        'UNKNOWN_ERROR',
        { url, method, originalError: error }
      );
    }

    throw new ApiClientError(
      'An unknown error occurred',
      undefined,
      'UNKNOWN_ERROR',
      { url, method, error }
    );
  }

  // Retry logic with exponential backoff
  private async withRetry<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const apiError = error as ApiClientError;
      
      if (
        attempt < this.retryConfig.maxRetries &&
        apiError.status &&
        this.retryConfig.retryableStatuses.includes(apiError.status)
      ) {
        const delay = this.retryConfig.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(operation, attempt + 1);
      }
      
      throw error;
    }
  }

  // Core request method with timeout and retry
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    authHeaders: Record<string, string> = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.withRetry(async () => {
        const response = await fetch(url, {
          ...options,
          headers: this.getAuthHeaders(authHeaders),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw response;
        }

        return response;
      });

      clearTimeout(timeoutId);
      
      // Handle empty responses
      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      try {
        return JSON.parse(text);
      } catch (parseError) {
        throw new ApiClientError(
          'Invalid JSON response from server',
          response.status,
          'PARSE_ERROR',
          { url, response: text }
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      this.handleError(error, url, options.method || 'GET');
    }
  }

  // HTTP method helpers
  async get<T>(
    endpoint: string,
    authHeaders?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, authHeaders);
  }

  async post<T>(
    endpoint: string,
    data?: unknown,
    authHeaders?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      authHeaders
    );
  }

  async put<T>(
    endpoint: string,
    data?: unknown,
    authHeaders?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      authHeaders
    );
  }

  async delete<T>(
    endpoint: string,
    authHeaders?: Record<string, string>
  ): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, authHeaders);
  }

  // Query parameter helper
  buildUrl(endpoint: string, params: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(endpoint, this.baseURL);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
    return url.pathname + url.search;
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Convenience function for creating auth headers
export function createAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

// Type-safe API endpoint definitions
export const API_ENDPOINTS = {
  // Dashboard
  DASHBOARD_STATS: '/api/dashboard',
  
  // Devices
  DEVICES: '/api/devices',
  DEVICE_STATS: '/api/devices/stats',
  DEVICE_BY_ID: (id: string) => `/api/devices/${id}`,
  DEVICE_POLL: (id: string) => `/api/devices/${id}/poll`,
  DEVICE_TEST_UBIQUITI: '/api/devices/test-ubiquiti',
  DEVICE_ADD_UBIQUITI: '/api/devices/add-ubiquiti',
  
  // Network
  NETWORK_TOPOLOGY: '/api/network/topology',
  NETWORK_MAP: '/api/network/map',
  
  // Alerts
  ALERTS: '/api/alerts',
  RECENT_ALERTS: '/api/alerts/recent',
  ALERT_BY_ID: (id: string) => `/api/alerts/${id}`,
  
  // Authentication
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  PROFILE: '/api/auth/profile',
  REFRESH_TOKEN: '/api/auth/refresh',
} as const;

export default apiClient;