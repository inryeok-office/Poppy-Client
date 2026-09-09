import type { ReactNode } from 'react';

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
// 감싸는(C자) 블록(Vector 3). 238×106, 입 높이는 실행 블록 1개(48) 기준으로 고정.
const CBLOCK_PATH =
  'M0 98V2C0 0.895431 0.89543 0 2 0H6V4C6 5.10457 6.89543 6 8 6H30C31.1046 6 32 5.10457 32 4V0H219C229.493 0 238 8.50659 238 19C238 29.4934 229.493 38 219 38H58V42C58 43.1046 57.1046 44 56 44H34C32.8954 44 32 43.1046 32 42V38H28C26.8954 38 26 38.8954 26 40V78C26 79.1046 26.8954 80 28 80H32V84C32 85.1046 32.8954 86 34 86H56C57.1046 86 58 85.1046 58 84V80H228C233.523 80 238 84.4771 238 90C238 95.5229 233.523 100 228 100H32V104C32 105.105 31.1046 106 30 106H8C6.89543 106 6 105.105 6 104V100H2C0.895431 100 0 99.1046 0 98Z';

type BlockVariant = 'statement' | 'hat' | 'cap';

const SHAPE: Record<BlockVariant, { path: string; w: number; h: number }> = {
  statement: { path: STATEMENT_PATH, w: 212, h: 48 },
  hat: { path: HAT_PATH, w: 212, h: 48 },
  cap: { path: CAP_PATH, w: 212, h: 42 },
};

/**
 * 값 입력 칸 (Rectangle 16/17). 32×22, radius 3.
 * 빈칸이면 자리표시(aria-hidden), 값이 있으면 ink 15px 로 가운데 표시 (Figma 33:914 "2").
 */
export function BlockInput({ children }: { children?: ReactNode }) {
  return (
    <span
      aria-hidden={children == null ? true : undefined}
      className="bg-page text-ink inline-flex h-[22px] w-8 shrink-0 items-center justify-center rounded-[3px] text-[15px]"
    >
      {children}
    </span>
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

/** 감싸는(C자) 블록. 헤더 줄 + 입(중첩 블록 1개). */
export function CBlock({
  color,
  header,
  children,
}: {
  color: BlockColor;
  header: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative shrink-0" style={{ width: 238, height: 106 }}>
      <svg
        viewBox="0 0 238 106"
        preserveAspectRatio="none"
        className={`absolute inset-0 size-full ${FILL[color]}`}
        aria-hidden
      >
        <path d={CBLOCK_PATH} />
      </svg>
      {/* 헤더 줄: 본체 상단 y0~38 */}
      <div className="absolute inset-x-0 top-0 flex h-[38px] items-center gap-1 pl-8 text-[15px] text-white">
        {header}
      </div>
      {/* 입: 좌측 팔(26px) 다음, y38~ */}
      <div className="absolute top-[38px] left-[26px] flex flex-col gap-1">{children}</div>
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
