/**
 * Local API client for the ResQKit backend — RN port of
 * app/frontend/src/lib/apiClient.ts. Same shape (client.auth, client.entities,
 * client.apiCall) so screen code reads the same on both platforms; the only
 * real difference is AsyncStorage (async) instead of localStorage (sync) for
 * the bearer token.
 */
import axios, { AxiosError, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'resqkit.auth.token';

export const getToken = (): Promise<string | null> => AsyncStorage.getItem(TOKEN_KEY);
const setToken = (token: string) => AsyncStorage.setItem(TOKEN_KEY, token);
const clearToken = () => AsyncStorage.removeItem(TOKEN_KEY);

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8001';

const http = axios.create({ baseURL: API_BASE_URL });

http.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
      await setToken(res.data.token);
      const me = await http.get<CurrentUser>('/api/v1/auth/me');
      return me.data;
    },
    async register(email: string, password: string, name?: string): Promise<CurrentUser> {
      const res = await http.post('/api/v1/auth/register', { email, password, name });
      await setToken(res.data.token);
      const me = await http.get<CurrentUser>('/api/v1/auth/me');
      return me.data;
    },
    async logout(): Promise<void> {
      await clearToken();
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
