import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/shared/api/msw/server';

import { AdminArenaView } from './AdminArenaView';

const BOOTH = {
  presetCode: '3x3-부스',
  widthM: 3,
  depthM: 3,
  marginM: 0.5,
  startXM: 2.5,
  startYM: 0.5,
  startHeading: '+Y',
  limits: { usableWidthM: 2, usableDepthM: 2, maxMovePerCommandM: 1.2, defaultMoveDistanceM: 0.5 },
  updatedAt: '2026-11-16T09:00:00Z',
};

const ok = (data: unknown) => HttpResponse.json({ success: true, data, error: null });
const fail = (status: number, code: string) =>
  HttpResponse.json({ success: false, data: null, error: { code, message: code } }, { status });

function renderView() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AdminArenaView />
    </QueryClientProvider>,
  );
}

const gridLines = (axis: 'x' | 'y') =>
  screen.getByTestId('admin-arena-grid').querySelectorAll(`line[data-axis="${axis}"]`).length;

describe('AdminArenaView', () => {
  it('세션이 없으면 PIN 을 묻고, 틀리면 알려 주고, 맞으면 현재 공간(6×6)을 보여 준다', async () => {
    let loggedIn = false;
    const logins: unknown[] = [];
    server.use(
      http.get('*/api/v1/admin/arena-settings/history', () =>
        loggedIn ? ok([]) : fail(401, 'ADMIN_SESSION_INVALID'),
      ),
      http.post('*/api/v1/admin/auth/login', async ({ request }) => {
        const body = (await request.json()) as { username: string; password: string };
        logins.push(body);
        if (body.password !== '2468') return fail(401, 'ADMIN_CREDENTIAL_INVALID');
        loggedIn = true;
        return ok({ authenticated: true });
      }),
    );
    const user = userEvent.setup();
    renderView();

    const pin = await screen.findByLabelText('관리자 PIN');
    expect(screen.queryByRole('button', { name: /3×3 부스/ })).not.toBeInTheDocument();
    await user.type(pin, '1111');
    await user.click(screen.getByRole('button', { name: '들어가기' }));
    expect(await screen.findByText('PIN 이 맞지 않아요.')).toBeInTheDocument();

    await user.clear(pin);
    await user.type(pin, '2468');
    await user.click(screen.getByRole('button', { name: '들어가기' }));
    expect(await screen.findByRole('button', { name: /6×6 박람회/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(logins).toEqual([
      { username: 'admin', password: '1111' },
      { username: 'admin', password: '2468' },
    ]);
    expect(screen.getByText('6 m × 6 m')).toBeInTheDocument();
    expect(screen.getByText('(5.6, 0.4) · +Y')).toBeInTheDocument();
    expect(gridLines('x')).toBe(11);
  });

  it('3×3 부스를 누르면 CSRF 헤더와 함께 저장하고, 표와 매트 그림이 3×3 으로 바뀐다', async () => {
    const puts: { body: unknown; csrf: string | null }[] = [];
    server.use(
      http.get('*/api/v1/admin/arena-settings/history', () => ok([])),
      http.get('*/api/v1/admin/auth/csrf', () =>
        ok({ headerName: 'X-CSRF-TOKEN', token: 'csrf-test' }),
      ),
      http.put('*/api/v1/admin/arena-settings', async ({ request }) => {
        puts.push({ body: await request.json(), csrf: request.headers.get('X-CSRF-TOKEN') });
        return ok(BOOTH);
      }),
    );
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole('button', { name: /3×3 부스/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('3×3 부스 로 바꿨어요.');
    expect(puts).toEqual([{ body: { presetCode: '3x3-부스' }, csrf: 'csrf-test' }]);
    expect(screen.getByRole('button', { name: /3×3 부스/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('3 m × 3 m')).toBeInTheDocument();
    expect(screen.getByText('2 m × 2 m')).toBeInTheDocument();
    expect(screen.getByText('1.2 m')).toBeInTheDocument();
    expect(screen.getByText('(2.5, 0.5) · +Y')).toBeInTheDocument();
    expect(gridLines('x')).toBe(5);
    expect(gridLines('y')).toBe(5);
    expect(screen.getByRole('img', { name: /매트 3m × 3m/ })).toBeInTheDocument();
  });

  it('저장하다 세션이 끊기면(401) PIN 화면으로 돌아간다', async () => {
    server.use(
      http.get('*/api/v1/admin/arena-settings/history', () => ok([])),
      http.get('*/api/v1/admin/auth/csrf', () => fail(401, 'ADMIN_SESSION_INVALID')),
    );
    const user = userEvent.setup();
    renderView();
    await user.click(await screen.findByRole('button', { name: /3×3 부스/ }));
    await waitFor(() => expect(screen.getByLabelText('관리자 PIN')).toBeInTheDocument());
  });

  it('로그인을 너무 많이 틀리면(429) 기다리라고 알려 준다', async () => {
    server.use(
      http.get('*/api/v1/admin/arena-settings/history', () => fail(401, 'ADMIN_SESSION_INVALID')),
      http.post('*/api/v1/admin/auth/login', () => fail(429, 'ADMIN_LOGIN_RATE_LIMITED')),
    );
    const user = userEvent.setup();
    renderView();
    await user.type(await screen.findByLabelText('관리자 PIN'), '0000');
    await user.click(screen.getByRole('button', { name: '들어가기' }));
    expect(
      await screen.findByText('여러 번 틀렸어요. 1분 뒤에 다시 해 주세요.'),
    ).toBeInTheDocument();
  });
});
