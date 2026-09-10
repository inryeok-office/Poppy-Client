// 팔레트·캔버스 블록 드래그의 순수 지오메트리. 스냅 판정만 담당한다.
// (레이아웃 측정·포인터 상태는 useBlockDrag 가 담당)

/** 이 거리 안으로 포인터가 들어오면 슬롯에 "딱" 붙는다 (사용자: "가까이 가져가면 딱 맞게"). */
export const SNAP_THRESHOLD_PX = 52;

/** 포인터가 이만큼 움직여야 드래그로 인정한다 (그 전엔 탭/클릭). */
export const DRAG_ACTIVATE_PX = 4;

export type SlotRect = {
  /** 삽입 인덱스 — program.stack 기준 1..length (start 앞 0 은 없음) */
  index: number;
  /** 슬롯의 세로 중심 (viewport 좌표) */
  centerY: number;
};

/** 포인터 Y 에 가장 가까운 스냅 슬롯. 임계 밖이면 null. */
export function nearestSlot(
  pointerY: number,
  slots: SlotRect[],
): { index: number; centerY: number; distance: number } | null {
  let best: { index: number; centerY: number; distance: number } | null = null;
  for (const slot of slots) {
    const distance = Math.abs(pointerY - slot.centerY);
    if (best === null || distance < best.distance) {
      best = { index: slot.index, centerY: slot.centerY, distance };
    }
  }
  return best && best.distance <= SNAP_THRESHOLD_PX ? best : null;
}

/** 두 점 사이 거리가 드래그 인정 임계를 넘었는지. */
export function movedEnough(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_ACTIVATE_PX;
}

/** 점이 사각형 안에 있는지 (캔버스 밖 = 삭제 판정). */
export function isWithin(
  rect: { top: number; bottom: number; left: number; right: number },
  x: number,
  y: number,
): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
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
    slots.push({ index: i, centerY });
  }
  return slots;
}
