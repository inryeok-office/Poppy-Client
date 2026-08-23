import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from './msw/server';
import { ApiError, api, toApiError } from './index';

describe('axios 인스턴스', () => {
  it('공통 설정을 인스턴스 하나에 모아둔다', () => {
    expect(api.defaults.timeout).toBe(10_000);
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('MSW가 가로챈 응답을 그대로 돌려준다', async () => {
    server.use(http.get('*/api/v1/health', () => HttpResponse.json({ success: true, data: 'ok' })));

    const response = await api.get('/api/v1/health');

    expect(response.data).toEqual({ success: true, data: 'ok' });
  });

  it('실패 응답을 ApiError로 정규화해서 올려보낸다', async () => {
    server.use(
      http.get('*/api/v1/health', () =>
        HttpResponse.json(
          { success: false, error: { code: 'SERVICE_DOWN', message: '점검 중입니다' } },
          { status: 503 },
        ),
      ),
    );

    await expect(api.get('/api/v1/health')).rejects.toMatchObject({
      status: 503,
      code: 'SERVICE_DOWN',
      message: '점검 중입니다',
    });
  });
});

describe('toApiError', () => {
  it('이미 ApiError면 그대로 돌려준다', () => {
    const original = new ApiError('그대로', 418, 'TEAPOT');

    expect(toApiError(original)).toBe(original);
  });

  it('axios가 아닌 오류도 ApiError로 정규화한다', () => {
    expect(toApiError(new Error('boom')).message).toBe('boom');
    expect(toApiError('문자열').message).toBe('알 수 없는 오류가 발생했습니다');
  });
});
