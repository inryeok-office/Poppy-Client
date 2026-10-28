// 팔레트·캔버스 블록 드래그의 순수 지오메트리. 스냅 판정만 담당한다.
// (레이아웃 측정·포인터 상태는 useBlockDrag 가 담당)

/** 이 거리 안으로 포인터가 들어오면 슬롯에 "딱" 붙는다 (기명서: "연결 가능한 지점에 가까워지면"). */
export const SNAP_THRESHOLD_PX = 52;

/** 포인터가 이만큼 움직여야 드래그로 인정한다 (그 전엔 탭/클릭). */
export const DRAG_ACTIVATE_PX = 4;

/** 스택 블록끼리 겹치는 노치 폭 — BlockStack 의 `-space-y-1.5`(-6px)와 맞춘 값. */
const BLOCK_JOINT_OVERLAP_PX = 6;

export type SlotRect = {
  /** 끼울 목록 — null 이면 스택, 아니면 그 반복 블록의 입(body) */
  parentId: string | null;
  /** 삽입 인덱스 — 스택은 1..(종료 앞), 반복 입은 0..body 길이 */
  index: number;
  /** 가장 가까운 슬롯을 고르기 위한 판정 기준점 (viewport 좌표) */
  centerY: number;
  /** 이 슬롯에 끼우면 새 블록의 상단이 실제로 놓일 위치 (viewport 좌표) — 미리보기 표시용 */
  top: number;
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
): { parentId: string | null; index: number; centerY: number } | null {
  let best: { parentId: string | null; index: number; centerY: number; dist: number } | null = null;
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
      best = { parentId: slot.parentId, index: slot.index, centerY: slot.centerY, dist };
  }
  return best ? { parentId: best.parentId, index: best.index, centerY: best.centerY } : null;
}

/** 두 점 사이 거리가 드래그 인정 임계를 넘었는지. */
export function movedEnough(from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  return Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_ACTIVATE_PX;
}

/**
 * 점이 사각형의 시각 영역 바깥 marginPx 까지(감지 영역) 안에 있는지.
 * 쓰레기통 삭제 감지에 쓴다(기명서: "시각 영역 바깥 30px 까지를 삭제 감지 영역으로").
 */
export function isNearRect(
  pointerX: number,
  pointerY: number,
  rect: { left: number; right: number; top: number; bottom: number },
  marginPx: number,
): boolean {
  return (
    pointerX >= rect.left - marginPx &&
    pointerX <= rect.right + marginPx &&
    pointerY >= rect.top - marginPx &&
    pointerY <= rect.bottom + marginPx
  );
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
    // 새 블록이 붙으면 그 위치의 형제들과 똑같이 -6px 겹쳐 물린다 — 그 자리를 그대로 미리 보여준다.
    const top = prev.bottom - BLOCK_JOINT_OVERLAP_PX;
    slots.push({ parentId: null, index: i, centerY, top, left: prev.left, right: prev.right });
  }
  return slots;
}

/** 측정한 블록 하나 — DOM 순서, parent 는 'root'(스택) 또는 반복 id. */
export type MeasuredBlock = { id: string; kind: string; parent: string; rect: DOMRect };
/** 반복 블록 입의 맨 위 지점 — 입이 비었으면 빈 자리 블록 전체. */
export type MeasuredMouth = { repeatId: string; rect: DOMRect };

/** 빈 입·첫 자리 슬롯 판정점을 입 위쪽 가장자리에서 이만큼 안쪽으로 둔다. */
const MOUTH_SLOT_INSET_PX = 12;

/**
 * 스택과 반복 입의 블록 사각형에서 삽입 슬롯 목록을 만든다.
 * 스택: 시작 다음(1) ~ 종료 앞까지. 종료 뒤에는 끼울 수 없다.
 * 반복 입(allowNested 일 때만): 입 맨 위(0)와 각 블록 다음. 반복 안에 반복은 넣지 않는다.
 */
export function slotsFromLayout(
  blocks: MeasuredBlock[],
  mouths: MeasuredMouth[],
  allowNested: boolean,
): SlotRect[] {
  const root = blocks.filter((b) => b.parent === 'root');
  const lastRootSlot = root.at(-1)?.kind === 'end' ? root.length - 1 : root.length;
  const slots = slotsFromBlockRects(root.map((b) => b.rect)).filter(
    (slot) => slot.index <= lastRootSlot,
  );
  if (!allowNested) return slots;

  for (const mouth of mouths) {
    const children = blocks.filter((b) => b.parent === mouth.repeatId);
    slots.push({
      parentId: mouth.repeatId,
      index: 0,
      centerY: mouth.rect.top + MOUTH_SLOT_INSET_PX,
      top: mouth.rect.top,
      left: mouth.rect.left,
      right: mouth.rect.left + 212,
    });
    children.forEach((child, i) => {
      const next = children[i + 1];
      slots.push({
        parentId: mouth.repeatId,
        index: i + 1,
        centerY: next ? (child.rect.bottom + next.rect.top) / 2 : child.rect.bottom,
        top: child.rect.bottom - BLOCK_JOINT_OVERLAP_PX,
        left: child.rect.left,
        right: child.rect.right,
      });
    });
  }
  return slots;
}
