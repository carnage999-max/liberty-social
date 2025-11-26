import axios, { AxiosInstance } from 'axios';
import { getApiBase } from '../constants/API';
import { storage } from './storage';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: getApiBase(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await storage.getAccessToken();
        if (token) {
          // Ensure Authorization header is set for both relative and absolute URLs
          config.headers.Authorization = `Bearer ${token}`;
        }
        // If config.url is absolute, ensure we still use the baseURL for auth
        // but axios will use the absolute URL directly
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await storage.getRefreshToken();
            if (refreshToken) {
              const response = await axios.post(`${getApiBase()}/auth/token/refresh/`, {
                refresh: refreshToken,
              });

              const { access } = response.data;
              await storage.setAccessToken(access);

              originalRequest.headers.Authorization = `Bearer ${access}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await storage.clearTokens();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.get(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post(url, data, config);
    return response.data;
  }

  async postFormData<T>(url: string, formData: FormData, config?: any): Promise<T> {
    // Remove Content-Type header to let FormData set it automatically with boundary
    const headers = { ...config?.headers };
    delete headers['Content-Type'];
    
    const response = await this.client.post(url, formData, {
      ...config,
      headers,
    });
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.patch(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: any): Promise<T> {
    const response = await this.client.delete(url, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.put(url, data, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();

