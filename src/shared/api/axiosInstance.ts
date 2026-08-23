import axios, { AxiosError } from 'axios';

// SSR에서는 백엔드를 직접 호출하고, 브라우저에서는 next.config.ts의 rewrites 프록시(/api)를 탄다.
const baseURL = typeof window === 'undefined' ? process.env.NEXT_PUBLIC_API_BASE_URL : '';

export const api = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: { requestId?: string | null };
}

export interface FieldError {
  field?: string;
  message?: string;
}

// 백엔드 응답 구조가 확정되면 이 형태를 맞춰서 갱신한다.
export interface ApiErrorBody {
  success?: boolean;
  error?: {
    code?: string;
    message?: string;
    status?: number;
    path?: string;
    timestamp?: string;
    fieldErrors?: FieldError[];
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const body = axiosError.response?.data?.error;
    return new ApiError(
      body?.message ?? axiosError.message,
      axiosError.response?.status ?? body?.status,
      body?.code,
      body?.fieldErrors ?? [],
    );
  }

  return new ApiError(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다');
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
);
