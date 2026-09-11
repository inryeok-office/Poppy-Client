'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import {
  carriedBlocks,
  dropOnCanvas,
  dropOnSlot,
  type BlockNode,
  type BlockProgram,
  type DragPick,
} from '../model/blockProgram';
import { BlockStack } from '../ui/BlockStack';
import { movedEnough, nearestSlot, slotsFromBlockRects, type SlotRect } from './blockDrag';

// 블록 드래그의 상태·포인터 배선. 순수 스냅 판정은 blockDrag.ts, 프로그램 변형은 blockProgram.ts.
//
// 기명서 "블록 드래그 이동·스냅 연결":
//   · 블록을 잡으면 아래에 연결된 블록이 함께 딸려온다 (carriedBlocks)
//   · 스택 슬롯에 가까우면 스냅 미리보기 → 스냅 안에서 놓으면 연결 (dropOnSlot)
//   · 스냅 밖에서 놓으면 연결 없이 놓은 자리에 둔다 (dropOnCanvas)

const CLONE_W = 220;
const CLONE_H = 44;

type DragState = {
  pick: DragPick;
  /** 함께 움직이는 블록들 (클론 렌더용) */
  carried: BlockNode[];
  /** 현재 포인터 위치 (viewport) */
  pointer: { x: number; y: number };
  /** 블록을 잡은 지점의 오프셋 */
  grab: { x: number; y: number };
  active: boolean;
  /** 스냅될 삽입 인덱스 (없으면 null — 놓은 자리에 그대로 둔다) */
  slotIndex: number | null;
  /** 스냅 미리보기 위치 (viewport) — 새 블록이 실제로 놓일 좌상단 */
  slot: { x: number; y: number } | null;
};

type BlockDragValue = {
  dragging: DragState | null;
  startDrag: (pick: DragPick, event: ReactPointerEvent) => void;
  registerStack: (el: HTMLElement | null) => void;
  registerCanvas: (el: HTMLElement | null) => void;
};

const BlockDragContext = createContext<BlockDragValue | null>(null);

export function useBlockDrag(): BlockDragValue {
  const ctx = useContext(BlockDragContext);
  if (!ctx) throw new Error('useBlockDrag 는 BlockDragProvider 안에서만 쓸 수 있어요.');
  return ctx;
}

type BlockDragProviderProps = {
  children: ReactNode;
  program: BlockProgram;
  /** 드롭 결과 프로그램 (스냅 연결 또는 자유 배치). */
  onChange: (next: BlockProgram) => void;
};

export function BlockDragProvider({ children, program, onChange }: BlockDragProviderProps) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const stackRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const cloneRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<DragState | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);
  const slotsRef = useRef<SlotRect[]>([]);

  // 드롭 순간 실제로 반영할 최신 프로그램. 드래그 도중 다른 경로(값 편집 등)로 program 이
  // 바뀌어도 finish() 가 드래그 시작 시점의 낡은 스냅샷으로 덮어쓰지 않게 한다.
  const programRef = useRef(program);
  useEffect(() => {
    programRef.current = program;
  }, [program]);

  const registerStack = useCallback((el: HTMLElement | null) => {
    stackRef.current = el;
  }, []);
  const registerCanvas = useCallback((el: HTMLElement | null) => {
    canvasRef.current = el;
  }, []);

  const commit = useCallback((next: DragState | null) => {
    stateRef.current = next;
    setDragging(next);
  }, []);

  // 잡는 순간의 program 은 "무엇을 잡았는지"(carried, 클론용) 를 정하는 데만 쓴다.
  // 실제로 반영할 때는 finish() 가 programRef.current(최신값)를 쓴다.
  const startDrag = useCallback(
    (pick: DragPick, event: ReactPointerEvent) => {
      teardownRef.current?.();

      const carried = carriedBlocks(program, pick);
      if (carried.length === 0) return;
      const carriedIds = new Set(carried.map((b) => b.id));

      const rect = event.currentTarget.getBoundingClientRect();
      const start = { x: event.clientX, y: event.clientY };
      commit({
        pick,
        carried,
        pointer: start,
        grab: { x: start.x - rect.left, y: start.y - rect.top },
        active: false,
        slotIndex: null,
        slot: null,
      });

      const handleMove = (e: PointerEvent) => {
        const cur = stateRef.current;
        if (!cur) return;
        const pointer = { x: e.clientX, y: e.clientY };

        if (!cur.active) {
          if (!movedEnough(start, pointer)) {
            commit({ ...cur, pointer });
            return;
          }
          // 드래그가 막 활성화되는 순간에만 슬롯을 측정한다 — 블록 위치는 드래그 중 안
          // 바뀌니 매 pointermove 마다 다시 재지 않는다. 잡고 있는 블록 자신은 측정에서
          // 뺀다(안 그러면 "자기 자리 안으로 옮기는" 미리보기가 뜨는데, 그 슬롯은 떼어낸
          // 뒤엔 존재하지 않아 조용히 원래 자리로 되돌아간다).
          const container = stackRef.current;
          const rects = container
            ? Array.from(container.querySelectorAll<HTMLElement>('[data-block]'))
                .filter((el) => !carriedIds.has(el.dataset.block ?? ''))
                .map((el) => el.getBoundingClientRect())
            : [];
          slotsRef.current = slotsFromBlockRects(rects);
        }

        const hit = nearestSlot(e.clientX, e.clientY, slotsRef.current);
        const slot = slotsRef.current.find((s) => s.index === hit?.index);

        commit({
          ...cur,
          pointer,
          active: true,
          slotIndex: hit?.index ?? null,
          slot: hit && slot ? { x: slot.left, y: slot.top } : null,
        });
      };

      const finish = () => {
        teardownRef.current?.();
        const cur = stateRef.current;
        // 클론이 사라지기(commit(null)) 전에 실제 렌더 크기를 읽는다 — 블록마다 모양이
        // 달라(반복 C블록 238×106, 실행 블록 212×48 …) 고정 크기로는 캔버스 경계를 잘못
        // 잡아 큰 블록이 삐져나갈 수 있다.
        const cloneRect = cloneRef.current?.getBoundingClientRect();
        commit(null);
        if (!cur?.active) return;

        const latestProgram = programRef.current;
        if (cur.slotIndex != null) {
          onChange(dropOnSlot(latestProgram, cur.pick, cur.slotIndex));
          return;
        }

        // 스냅 안 됨 — 놓은 자리(캔버스 좌표)에 둔다.
        const canvas = canvasRef.current?.getBoundingClientRect();
        if (!canvas) return;
        const onCanvas =
          cur.pointer.x >= canvas.left &&
          cur.pointer.x <= canvas.right &&
          cur.pointer.y >= canvas.top &&
          cur.pointer.y <= canvas.bottom;
        // 팔레트 블록을 캔버스 밖에 놓으면 버린다 (놓을 자리가 없음)
        if (cur.pick.origin === 'palette' && !onCanvas) return;

        const cloneW = cloneRect?.width ?? CLONE_W;
        const cloneH = cloneRect?.height ?? CLONE_H;
        const x = clamp(cur.pointer.x - canvas.left - cur.grab.x, 0, canvas.width - cloneW);
        const y = clamp(cur.pointer.y - canvas.top - cur.grab.y, 0, canvas.height - cloneH);
        onChange(dropOnCanvas(latestProgram, cur.pick, x, y));
      };

      const teardown = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        teardownRef.current = null;
      };
      teardownRef.current = teardown;
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [commit, program, onChange],
  );

  useEffect(() => () => teardownRef.current?.(), []);

  const active = dragging?.active ?? false;
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    document.body.classList.add('cursor-grabbing', 'select-none');
    return () => document.body.classList.remove('cursor-grabbing', 'select-none');
  }, [active]);

  const value = useMemo<BlockDragValue>(
    () => ({ dragging, startDrag, registerStack, registerCanvas }),
    [dragging, startDrag, registerStack, registerCanvas],
  );

  return (
    <BlockDragContext.Provider value={value}>
      {children}
      {dragging?.active && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={cloneRef}
              aria-hidden
              className="pointer-events-none fixed z-50 select-none"
              style={{
                left: dragging.pointer.x - dragging.grab.x,
                top: dragging.pointer.y - dragging.grab.y,
              }}
            >
              <BlockStack nodes={dragging.carried} />
            </div>,
            document.body,
          )
        : null}
    </BlockDragContext.Provider>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
