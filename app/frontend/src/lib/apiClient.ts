/**
 * Local API client for the ResQKit backend.
 *
 * Replaces the previous cloud-platform SDK. Talks only to this app's own
 * FastAPI backend (see `getAPIBaseURL()`); no other service is contacted.
 * Auth is a bearer token stored in localStorage and attached to every
 * request - never a cookie, so there is nothing to leak cross-origin.
 */
import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAPIBaseURL } from './config';

const TOKEN_KEY = 'resqkit.auth.token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const http = axios.create();

http.interceptors.request.use((config) => {
  config.baseURL = getAPIBaseURL();
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize axios errors to `{ data, message }` so existing call sites
// (written against the previous SDK's error shape) keep working unchanged.
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    return Promise.reject({
      data: error.response?.data,
      status: error.response?.status,
      message: error.message,
    });
  },
);

export interface CurrentUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  last_login?: string;
}

interface QueryParams {
  query?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  skip?: number;
  fields?: string[];
}

function makeEntityClient(name: string) {
  const base = `/api/v1/entities/${name}`;
  return {
    query: <T = unknown>(params: QueryParams = {}): Promise<AxiosResponse<T>> =>
      http.get(base, {
        params: {
          ...(params.query ? { query: JSON.stringify(params.query) } : {}),
          ...(params.sort ? { sort: params.sort } : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
          ...(params.skip !== undefined ? { skip: params.skip } : {}),
          ...(params.fields ? { fields: params.fields.join(',') } : {}),
        },
      }),
    get: <T = unknown>(params: { id: string }): Promise<AxiosResponse<T>> => http.get(`${base}/${params.id}`),
    create: <T = unknown>(params: { data: Record<string, unknown> }): Promise<AxiosResponse<T>> =>
      http.post(base, params.data),
    update: <T = unknown>(params: { id: string; data: Record<string, unknown> }): Promise<AxiosResponse<T>> =>
      http.put(`${base}/${params.id}`, params.data),
    delete: <T = unknown>(params: { id: string }): Promise<AxiosResponse<T>> => http.delete(`${base}/${params.id}`),
  };
}

export const client = {
  auth: {
    async me(): Promise<AxiosResponse<CurrentUser>> {
      return http.get('/api/v1/auth/me');
    },
    async login(email: string, password: string): Promise<CurrentUser> {
      const res = await http.post('/api/v1/auth/login', { email, password });
      setToken(res.data.token);
      const me = await http.get<CurrentUser>('/api/v1/auth/me');
      return me.data;
    },
    async register(email: string, password: string, name?: string): Promise<CurrentUser> {
      const res = await http.post('/api/v1/auth/register', { email, password, name });
      setToken(res.data.token);
      const me = await http.get<CurrentUser>('/api/v1/auth/me');
      return me.data;
    },
    async logout(): Promise<void> {
      clearToken();
    },
    toLogin(): void {
      window.location.assign('/login');
    },
  },
  entities: {
    incident_records: makeEntityClient('incident_records'),
    registered_kits: makeEntityClient('registered_kits'),
  } as Record<string, ReturnType<typeof makeEntityClient>>,
  apiCall: {
    invoke: <T = unknown>(params: {
      url: string;
      method?: string;
      data?: Record<string, unknown>;
    }): Promise<AxiosResponse<T>> =>
      http.request({ url: params.url, method: params.method ?? 'GET', data: params.data }),
  },
};
