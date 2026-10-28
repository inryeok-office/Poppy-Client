import type { ReactNode } from 'react';

import type { BlockKind } from '../model/blockProgram';

// Figma node 21:520 — 블록 배경은 Figma에서 export 한 정확한 벡터 경로를 그대로 인라인한다.
// (자산 URL은 7일 후 만료돼서 경로 문자열만 커밋. 색은 @theme block-* 와 동일한 값)
//
// 샘플(자리표시) 블록은 크기가 고정이라 SVG 를 콘텐츠에 맞춰 고정 픽셀로 둔다.
// 가변 높이(중첩 블록 N개)의 9-슬라이스 렌더링은 실제 블록 에디터 기능에서.

export type BlockColor = 'start' | 'flow' | 'move' | 'action';

const FILL: Record<BlockColor, string> = {
  start: 'fill-block-start',
  flow: 'fill-block-flow',
  move: 'fill-block-move',
  action: 'fill-block-action',
};

// 실행 블록 3종(초 기다리기 · 뒤로 m 이동 · 인사하기)은 동일 형태. 212×48 (본체 42 + 하단 노치 6).
const STATEMENT_PATH =
  'M0 2V40C0 41.1046 0.895431 42 2 42H6V46C6 47.1046 6.89543 48 8 48H30C31.1046 48 32 47.1046 32 46V42H191C202.598 42 212 32.598 212 21C212 9.40202 202.598 0 191 0H32V4C32 5.10457 31.1046 6 30 6H19H8C6.89543 6 6 5.10457 6 4V0H2C0.895431 0 0 0.89543 0 2Z';
// 시작 블록(31:262 Rectangle 10). 상단 좌측 큰 라운드(모자형), 상단 노치 없음. 212×48.
const HAT_PATH =
  'M0 16V40C0 41.1046 0.895431 42 2 42H6V46C6 47.1046 6.89543 48 8 48H30C31.1046 48 32 47.1046 32 46V42H191C202.598 42 212 32.598 212 21C212 9.40202 202.598 0 191 0H16C7.16344 0 0 7.16344 0 16Z';
// 종료 블록(Rectangle 11). 하단 좌측 큰 라운드, 하단 노치 없음. 212×42.
const CAP_PATH =
  'M0 2V26C0 34.8366 7.16344 42 16 42H191C202.598 42 212 32.598 212 21C212 9.40202 202.598 0 191 0H32V4C32 5.10457 31.1046 6 30 6H19H8C6.89543 6 6 5.10457 6 4V0H2C0.895431 0 0 0.89543 0 2Z';
// 감싸는(C자) 블록(Vector 3). 기본 238×106 — 입 높이 42(실행 블록 1개)이고, 입에 블록이 n개
// 들어가면 실행 블록 하나의 피치(48 - 겹침 6 = 42)씩 입과 아래 막대가 내려간다.
const CBLOCK_MOUTH_PITCH = 42;
const CBLOCK_BASE_HEIGHT = 106;

/** 입에 실행 블록 slots 개(최소 1)가 들어가는 C블록 경로와 높이. */
export function cblockShape(slots: number): { path: string; h: number } {
  const d = CBLOCK_MOUTH_PITCH * (Math.max(1, slots) - 1);
  const y = (v: number) => v + d;
  const path =
    `M0 ${y(98)}V2C0 0.895431 0.89543 0 2 0H6V4C6 5.10457 6.89543 6 8 6H30C31.1046 6 32 5.10457 32 4V0H219C229.493 0 238 8.50659 238 19C238 29.4934 229.493 38 219 38H58V42C58 43.1046 57.1046 44 56 44H34C32.8954 44 32 43.1046 32 42V38H28C26.8954 38 26 38.8954 26 40V${y(78)}` +
    `C26 ${y(79.1046)} 26.8954 ${y(80)} 28 ${y(80)}H32V${y(84)}C32 ${y(85.1046)} 32.8954 ${y(86)} 34 ${y(86)}H56C57.1046 ${y(86)} 58 ${y(85.1046)} 58 ${y(84)}V${y(80)}` +
    `H228C233.523 ${y(80)} 238 ${y(84.4771)} 238 ${y(90)}C238 ${y(95.5229)} 233.523 ${y(100)} 228 ${y(100)}H32V${y(104)}` +
    `C32 ${y(105.105)} 31.1046 ${y(106)} 30 ${y(106)}H8C6.89543 ${y(106)} 6 ${y(105.105)} 6 ${y(104)}V${y(100)}H2C0.895431 ${y(100)} 0 ${y(99.1046)} 0 ${y(98)}Z`;
  return { path, h: CBLOCK_BASE_HEIGHT + d };
}

const CBLOCK_PATH = cblockShape(1).path;

type BlockVariant = 'statement' | 'hat' | 'cap';

const SHAPE: Record<BlockVariant, { path: string; w: number; h: number }> = {
  statement: { path: STATEMENT_PATH, w: 212, h: 48 },
  hat: { path: HAT_PATH, w: 212, h: 48 },
  cap: { path: CAP_PATH, w: 212, h: 42 },
};

const BLOCK_INPUT_CLASS =
  'bg-page text-ink h-[22px] w-8 shrink-0 rounded-[3px] text-center text-[15px]';

type BlockInputProps = {
  /** 표시/입력 값. 없으면 빈 자리표시. */
  value?: number;
  /** 넘기면 숫자 입력 칸이 된다. 없으면 읽기 전용. */
  onChange?: (next: number) => void;
  min?: number;
  max?: number;
  /** 소수 입력 단위(예: 0.1). 없으면 정수로 자른다. */
  step?: number;
  'aria-label'?: string;
};

/**
 * 값 입력 칸 (Rectangle 16/17). 32×22, radius 3, Figma 33:914 "2".
 * onChange 를 주면 편집 가능한 숫자 칸, 아니면 값만 표시한다.
 */
export function BlockInput({ value, onChange, min = 1, max = 99, step, ...rest }: BlockInputProps) {
  if (!onChange) {
    return (
      <span
        aria-hidden={value == null ? true : undefined}
        className={`${BLOCK_INPUT_CLASS} inline-flex items-center justify-center`}
        {...rest}
      >
        {value}
      </span>
    );
  }

  return (
    <input
      type="number"
      inputMode={step ? 'decimal' : 'numeric'}
      value={value ?? min}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (!Number.isFinite(next)) return;
        // step 단위로 반올림해 0.30000000000000004 같은 부동소수 오차를 남기지 않는다.
        const snapped = step
          ? Number((Math.round(next / step) * step).toFixed(6))
          : Math.trunc(next);
        onChange(Math.min(max, Math.max(min, snapped)));
      }}
      className={`${BLOCK_INPUT_CLASS} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      {...rest}
    />
  );
}

/** 실행 블록. 텍스트는 좌측 32px, 본체(상단 42px) 세로 중앙. */
export function Block({
  color,
  variant = 'statement',
  children,
}: {
  color: BlockColor;
  variant?: BlockVariant;
  children: ReactNode;
}) {
  const s = SHAPE[variant];
  return (
    <div className="relative shrink-0" style={{ width: s.w, height: s.h }}>
      <svg
        viewBox={`0 0 ${s.w} ${s.h}`}
        preserveAspectRatio="none"
        className={`absolute inset-0 size-full ${FILL[color]}`}
        aria-hidden
      >
        <path d={s.path} />
      </svg>
      <div className="absolute inset-x-0 top-0 flex h-[42px] items-center gap-1 pr-6 pl-8 text-[15px] text-white">
        {children}
      </div>
    </div>
  );
}

/**
 * 감싸는(C자) 블록. 헤더 줄 + 입. 입 높이는 안에 든 블록 수(slots, 최소 1)만큼 늘어난다.
 * children 은 입 안(좌측 팔 26px 다음, y38~)에 그대로 놓인다.
 */
export function CBlock({
  color,
  header,
  slots = 1,
  children,
}: {
  color: BlockColor;
  header: ReactNode;
  slots?: number;
  children?: ReactNode;
}) {
  const shape = cblockShape(slots);
  return (
    <div className="relative shrink-0" style={{ width: 238, height: shape.h }}>
      <svg
        viewBox={`0 0 238 ${shape.h}`}
        preserveAspectRatio="none"
        className={`absolute inset-0 size-full ${FILL[color]}`}
        aria-hidden
      >
        <path d={shape.path} />
      </svg>
      {/* 헤더 줄: 본체 상단 y0~38 */}
      <div className="absolute inset-x-0 top-0 flex h-[38px] items-center gap-1 pl-8 text-[15px] text-white">
        {header}
      </div>
      {/* 입: 좌측 팔(26px) 다음, y38~ */}
      <div className="absolute top-[38px] left-[26px]">{children}</div>
    </div>
  );
}

/** 빈 반복 블록의 입 자리 — 점선 실행 블록 모양 + 오류 테두리 색. */
export function EmptyMouth({ invalid = false }: { invalid?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: 212, height: 48 }}>
      <svg
        viewBox="0 0 212 48"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <path
          d={STATEMENT_PATH}
          fill="#fffaf3"
          stroke={invalid ? '#b91c1c' : '#c9bdae'}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      </svg>
      <div
        className={`absolute inset-x-0 top-0 flex h-[42px] items-center pr-6 pl-8 text-[13px] ${
          invalid ? 'text-danger' : 'text-muted'
        }`}
      >
        반복할 블록을 넣어 주세요
      </div>
    </div>
  );
}

/** 자리표시(점선) 블록 — "다음 블록을 붙여주세요". 실행 블록 형태에 점선 외곽선. */
export function GhostBlock({ children }: { children: ReactNode }) {
  return (
    <div className="relative shrink-0" style={{ width: 212, height: 48 }}>
      <svg
        viewBox="0 0 212 48"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <path
          d={STATEMENT_PATH}
          fill="none"
          stroke="#c9bdae"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      </svg>
      <div className="text-muted absolute inset-x-0 top-0 flex h-[42px] items-center pr-6 pl-8 text-[14px]">
        {children}
      </div>
    </div>
  );
}

// 블록 종류별 윤곽 (드래그 스냅 미리보기용). start=모자형·end=캡형·repeat=C블록,
// 나머지(실행 블록)는 STATEMENT_PATH.
const OUTLINE_SHAPE: Record<BlockKind, { path: string; w: number; h: number }> = {
  start: { path: HAT_PATH, w: 212, h: 48 },
  end: { path: CAP_PATH, w: 212, h: 42 },
  move: { path: STATEMENT_PATH, w: 212, h: 48 },
  moveForward: { path: STATEMENT_PATH, w: 212, h: 48 },
  rotateLeft: { path: STATEMENT_PATH, w: 212, h: 48 },
  rotateRight: { path: STATEMENT_PATH, w: 212, h: 48 },
  stop: { path: STATEMENT_PATH, w: 212, h: 48 },
  wait: { path: STATEMENT_PATH, w: 212, h: 48 },
  greet: { path: STATEMENT_PATH, w: 212, h: 48 },
  sit: { path: STATEMENT_PATH, w: 212, h: 48 },
  standUp: { path: STATEMENT_PATH, w: 212, h: 48 },
  heart: { path: STATEMENT_PATH, w: 212, h: 48 },
  dance: { path: STATEMENT_PATH, w: 212, h: 48 },
  roll: { path: STATEMENT_PATH, w: 212, h: 48 },
  attack: { path: STATEMENT_PATH, w: 212, h: 48 },
  repeat: { path: CBLOCK_PATH, w: 238, h: 106 },
};

/**
 * 스냅 미리보기 윤곽 — GhostBlock과 같은 점선 스타일을, 잡은 블록의 실제 모양(직사각형이 아니라
 * 시작=모자형·종료=캡형·반복=C블록 노치)으로 그린다.
 */
export function BlockOutline({ kind }: { kind: BlockKind }) {
  const s = OUTLINE_SHAPE[kind];
  return (
    <svg
      viewBox={`0 0 ${s.w} ${s.h}`}
      width={s.w}
      height={s.h}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={s.path} fill="none" stroke="#c9bdae" strokeWidth="1.5" strokeDasharray="4 3" />
    </svg>
  );
}
