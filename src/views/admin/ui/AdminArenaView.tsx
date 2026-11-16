'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import {
  applyArenaPreset,
  fetchArenaSettings,
  hasAdminSession,
  loginAdmin,
  type ArenaPresetCode,
  type CurrentArenaSettings,
} from '@/features/admin';
import { ARENA_QUERY_KEY, formatMeters } from '@/features/simulation';
import { ApiError } from '@/shared/api';

// 교사가 휴대폰으로 여는 관리자 화면 — 체험 공간 프리셋만 바꾼다.
// 경로는 숨기지 않고 Server 관리자 인증(PIN = 관리자 비밀번호)으로 막는다.

const SESSION_KEY = ['admin', 'session'] as const;
const SETTINGS_KEY = ['admin', 'arena-settings'] as const;

const PRESETS: { code: ArenaPresetCode; label: string; detail: string }[] = [
  { code: '6x6-박람회', label: '6×6 박람회', detail: '6 m × 6 m 매트' },
  { code: '3x3-부스', label: '3×3 부스', detail: '3 m × 3 m 부스' },
];

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'PIN 이 맞지 않아요.';
    if (error.status === 429) return '여러 번 틀렸어요. 1분 뒤에 다시 해 주세요.';
    if (error.status === 404) return '서버에 공간 설정 기능이 아직 없어요.';
  }
  return '서버에 연결하지 못했어요. 잠시 뒤 다시 해 주세요.';
}

export function AdminArenaView() {
  const session = useQuery({ queryKey: SESSION_KEY, queryFn: hasAdminSession, retry: false });

  return (
    <main className="bg-page text-ink min-h-dvh px-4 py-6">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <header className="flex items-baseline justify-between">
          <h1 className="text-[20px]">체험 공간 설정</h1>
          <Link href="/experience" className="text-muted text-[14px] underline">
            체험 화면
          </Link>
        </header>
        {session.isPending ? (
          <p className="text-muted text-[15px]">확인하는 중…</p>
        ) : session.data === true ? (
          <ArenaPanel />
        ) : (
          <PinLogin />
        )}
      </div>
    </main>
  );
}

function PinLogin() {
  const queryClient = useQueryClient();
  const [pin, setPin] = useState('');
  const login = useMutation({
    mutationFn: loginAdmin,
    onSuccess: () => queryClient.setQueryData(SESSION_KEY, true),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pin.trim()) login.mutate(pin.trim());
  };

  return (
    <form
      onSubmit={submit}
      className="border-line bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <label htmlFor="admin-pin" className="text-[15px]">
        관리자 PIN
      </label>
      <input
        id="admin-pin"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        className="border-line rounded-lg border bg-white px-3 py-3 text-[18px] tracking-widest"
      />
      {login.isError && (
        <p role="alert" className="text-danger text-[14px]">
          {errorText(login.error)}
        </p>
      )}
      <button
        type="submit"
        disabled={login.isPending || !pin.trim()}
        className="bg-primary rounded-lg py-3 text-[16px] text-white disabled:opacity-50"
      >
        {login.isPending ? '확인 중…' : '들어가기'}
      </button>
    </form>
  );
}

function ArenaPanel() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchArenaSettings, retry: false });
  const [message, setMessage] = useState<string | null>(null);
  const apply = useMutation({
    mutationFn: applyArenaPreset,
    onSuccess: (data, code) => {
      queryClient.setQueryData(SETTINGS_KEY, data);
      void queryClient.invalidateQueries({ queryKey: ARENA_QUERY_KEY });
      setMessage(`${PRESETS.find((preset) => preset.code === code)?.label ?? code} 로 바꿨어요.`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        queryClient.setQueryData(SESSION_KEY, false);
      }
      setMessage(null);
    },
  });

  if (settings.isPending) return <p className="text-muted text-[15px]">불러오는 중…</p>;
  if (settings.isError) {
    return (
      <p role="alert" className="text-danger text-[15px]">
        {errorText(settings.error)}
      </p>
    );
  }
  const current = settings.data;

  return (
    <>
      <section aria-label="프리셋" className="grid grid-cols-2 gap-3">
        {PRESETS.map((preset) => {
          const active = current.presetCode === preset.code;
          return (
            <button
              key={preset.code}
              type="button"
              aria-pressed={active}
              disabled={apply.isPending}
              onClick={() => apply.mutate(preset.code)}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-5 transition-colors disabled:opacity-60 ${
                active ? 'border-primary bg-primary text-white' : 'border-line bg-card text-ink'
              }`}
            >
              <span className="text-[20px]">{preset.label}</span>
              <span className={`text-[13px] ${active ? 'text-white/90' : 'text-muted'}`}>
                {active ? '지금 사용 중' : preset.detail}
              </span>
            </button>
          );
        })}
      </section>
      {apply.isPending && <p className="text-muted text-[14px]">바꾸는 중…</p>}
      {message && (
        <p role="status" className="text-success text-[15px]">
          {message} 체험 화면은 새로 열면 바로 적용돼요.
        </p>
      )}
      {apply.isError && (
        <p role="alert" className="text-danger text-[14px]">
          {errorText(apply.error)}
        </p>
      )}
      <ArenaSummary settings={current} />
      <ArenaMap settings={current} />
    </>
  );
}

function ArenaSummary({ settings }: { settings: CurrentArenaSettings }) {
  const rows = [
    ['크기', `${formatMeters(settings.widthM)} m × ${formatMeters(settings.depthM)} m`],
    ['벽 여유', `${formatMeters(settings.marginM)} m`],
    [
      '움직일 수 있는 영역',
      `${formatMeters(settings.limits.usableWidthM)} m × ${formatMeters(settings.limits.usableDepthM)} m`,
    ],
    [
      '출발점',
      `(${formatMeters(settings.startXM)}, ${formatMeters(settings.startYM)}) · ${settings.startHeading}`,
    ],
    ['한 번에 최대 이동', `${formatMeters(settings.limits.maxMovePerCommandM)} m`],
    ['이동 블록 기본값', `${formatMeters(settings.limits.defaultMoveDistanceM)} m`],
  ];
  return (
    <dl
      aria-label="현재 공간"
      className="border-line bg-card flex flex-col gap-2 rounded-xl border p-4"
    >
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="text-muted text-[14px]">{label}</dt>
          <dd className="text-[16px]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 0.5 m 격자 매트 그림 — 6×6 은 촘촘하고 3×3 은 칸이 커 보여 전환이 눈에 띈다. */
const MAP_PX = 240;
const GRID_STEP_M = 0.5;

export function ArenaMap({ settings }: { settings: CurrentArenaSettings }) {
  const { widthM, depthM, marginM, startXM, startYM } = settings;
  const scale = MAP_PX / Math.max(widthM, depthM);
  const w = widthM * scale;
  const h = depthM * scale;
  const toX = (m: number) => m * scale;
  const toY = (m: number) => h - m * scale;
  const lines = (length: number) =>
    Array.from(
      { length: Math.max(0, Math.round(length / GRID_STEP_M) - 1) },
      (_, i) => (i + 1) * GRID_STEP_M,
    );

  return (
    <figure className="border-line bg-card flex flex-col items-center gap-2 rounded-xl border p-4">
      <svg
        role="img"
        aria-label={`매트 ${formatMeters(widthM)}m × ${formatMeters(depthM)}m, 출발점 표시`}
        viewBox={`-8 -8 ${w + 16} ${h + 16}`}
        className="w-full max-w-[280px]"
      >
        <g data-testid="admin-arena-grid" className="stroke-[#d8cfc2]">
          {lines(widthM).map((m) => (
            <line
              key={`x${m}`}
              data-axis="x"
              x1={toX(m)}
              x2={toX(m)}
              y1={0}
              y2={h}
              strokeWidth={Number.isInteger(m) ? 1.2 : 0.6}
            />
          ))}
          {lines(depthM).map((m) => (
            <line
              key={`y${m}`}
              data-axis="y"
              x1={0}
              x2={w}
              y1={toY(m)}
              y2={toY(m)}
              strokeWidth={Number.isInteger(m) ? 1.2 : 0.6}
            />
          ))}
        </g>
        <rect x={0} y={0} width={w} height={h} className="stroke-ink fill-none" strokeWidth={2} />
        <rect
          x={toX(marginM)}
          y={toY(depthM - marginM)}
          width={w - 2 * marginM * scale}
          height={h - 2 * marginM * scale}
          strokeDasharray="5 4"
          className="stroke-muted fill-none"
        />
        <g data-testid="admin-arena-start" transform={`translate(${toX(startXM)} ${toY(startYM)})`}>
          <circle r={7} className="fill-success" />
          <path d="M0 -15 L5 -7 L-5 -7 Z" className="fill-success" />
        </g>
      </svg>
      <figcaption className="text-muted text-[13px]">
        격자 0.5 m · 점선 안이 움직일 수 있는 영역 · 초록 점이 출발점(위쪽을 봄)
      </figcaption>
    </figure>
  );
}
