// 팔레트·캔버스 블록 드래그의 순수 지오메트리. 스냅 판정만 담당한다.
// (레이아웃 측정·포인터 상태는 useBlockDrag 가 담당)

/** 이 거리 안으로 포인터가 들어오면 슬롯에 "딱" 붙는다 (기명서: "연결 가능한 지점에 가까워지면"). */
export const SNAP_THRESHOLD_PX = 52;

/** 포인터가 이만큼 움직여야 드래그로 인정한다 (그 전엔 탭/클릭). */
export const DRAG_ACTIVATE_PX = 4;

export type SlotRect = {
  /** 삽입 인덱스 — program.stack 기준 1..length (start 앞 0 은 없음) */
  index: number;
  /** 슬롯의 세로 중심 (viewport 좌표) */
  centerY: number;
  /** 슬롯이 놓인 스택 블록의 가로 범위 (viewport 좌표) */
  left: number;
  right: number;
};

/**
 * 포인터에 가장 가까운 스냅 슬롯. 세로로 임계 안이고 가로로도 스택 근처여야 스냅한다
 * (기명서: 스냅 거리 밖이면 연결 없이 그 자리에 둔다).
 */
export function nearestSlot(
  pointerX: number,
  pointerY: number,
  slots: SlotRect[],
): { index: number; centerY: number } | null {
  let best: { index: number; centerY: number; dist: number } | null = null;
  for (const slot of slots) {
    const dy = Math.abs(pointerY - slot.centerY);
    const dx =
      pointerX < slot.left
        ? slot.left - pointerX
        : pointerX > slot.right
          ? pointerX - slot.right
          : 0;
    if (dy > SNAP_THRESHOLD_PX || dx > SNAP_THRESHOLD_PX) continue;
    const dist = Math.hypot(dx, dy);
    if (best === null || dist < best.dist)
      best = { index: slot.index, centerY: slot.centerY, dist };
  }
  return best ? { index: best.index, centerY: best.centerY } : null;
}

/** 두 점 사이 거리가 드래그 인정 임계를 넘었는지. */
export function movedEnough(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_ACTIVATE_PX;
}

/**
 * 스택 블록 요소들의 사각형에서 삽입 슬롯 목록을 만든다.
 * 슬롯 i 는 "블록 i-1 다음" — 블록 i-1 하단과 블록 i 상단의 중점.
 */
export function slotsFromBlockRects(rects: DOMRect[]): SlotRect[] {
  const slots: SlotRect[] = [];
  for (let i = 1; i <= rects.length; i += 1) {
    const prev = rects[i - 1];
    const next = rects[i];
    const centerY = next ? (prev.bottom + next.top) / 2 : prev.bottom;
    slots.push({ index: i, centerY, left: prev.left, right: prev.right });
  }
  return slots;
}
