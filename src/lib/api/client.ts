// Axios instance for the Spring Boot API. Adds the bearer access token on every request and
// transparently rotates the refresh token on a 401, retrying the original request once.
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { authTokens } from "@/lib/auth/store";
import type { AuthResponse } from "@/lib/api/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// A bare client (no interceptors) used only for the refresh call, to avoid recursion.
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authTokens.getAccess();
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }
  return config;
});

// Single in-flight refresh shared by all concurrent 401s.
let refreshing: Promise<string | null> | null = null;

async function rotateRefreshToken(): Promise<string | null> {
  const refreshToken = authTokens.getRefresh();
  if (!refreshToken) return null;
  try {
    const { data } = await refreshClient.post<AuthResponse>("/auth/refresh", {
      refreshToken,
    });
    authTokens.setSession(data);
    return data.accessToken;
  } catch {
    authTokens.clear();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as
      | (AxiosRequestConfig & { _retried?: boolean })
      | undefined;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      authTokens.getRefresh()
    ) {
      original._retried = true;
      if (!refreshing) refreshing = rotateRefreshToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        const headers = AxiosHeaders.from(original.headers as AxiosHeaders);
        headers.set("Authorization", `Bearer ${newToken}`);
        original.headers = headers;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);

/** Normalizes an axios error into a human-readable message from the backend's ApiError shape. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; error?: string; detail?: string }
      | undefined;
    return data?.message ?? data?.error ?? data?.detail ?? err.message ?? fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
