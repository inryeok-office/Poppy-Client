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
import { movedEnough, nearestSlot, slotsFromBlockRects } from './blockDrag';

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
  /** 스냅될 삽입 인덱스 */
  slotIndex: number | null;
  /** 스냅 인디케이터 위치 (viewport) */
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
  /** 드롭 결과 프로그램. kind 는 안내 문구용. */
  onChange: (next: BlockProgram, kind: 'connect' | 'place') => void;
};

export function BlockDragProvider({ children, program, onChange }: BlockDragProviderProps) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const stackRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef<DragState | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);

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

  // 드래그는 시작 시점의 프로그램 스냅샷을 기준으로 계산한다 (드래그 중엔 바뀌지 않는다).
  const startDrag = useCallback(
    (pick: DragPick, event: ReactPointerEvent) => {
      teardownRef.current?.();

      const carried = carriedBlocks(program, pick);
      if (carried.length === 0) return;

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
        if (!cur.active && !movedEnough(start, pointer)) {
          commit({ ...cur, pointer });
          return;
        }

        const container = stackRef.current;
        const rects = container
          ? Array.from(container.querySelectorAll<HTMLElement>('[data-block]')).map((b) =>
              b.getBoundingClientRect(),
            )
          : [];
        const hit = nearestSlot(e.clientX, e.clientY, slotsFromBlockRects(rects));

        commit({
          ...cur,
          pointer,
          active: true,
          slotIndex: hit?.index ?? null,
          slot:
            hit && container ? { x: container.getBoundingClientRect().left, y: hit.centerY } : null,
        });
      };

      const finish = () => {
        teardownRef.current?.();
        const cur = stateRef.current;
        commit(null);
        if (!cur?.active) return;

        if (cur.slotIndex != null) {
          onChange(dropOnSlot(program, cur.pick, cur.slotIndex), 'connect');
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

        const x = clamp(cur.pointer.x - canvas.left - cur.grab.x, 0, canvas.width - CLONE_W);
        const y = clamp(cur.pointer.y - canvas.top - cur.grab.y, 0, canvas.height - CLONE_H);
        onChange(dropOnCanvas(program, cur.pick, x, y), 'place');
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
              aria-hidden
              className="pointer-events-none fixed z-50 opacity-90 drop-shadow-lg"
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
