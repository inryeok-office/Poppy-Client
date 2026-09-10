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

import { type BlockNode } from '../model/blockProgram';
import { BlockGlyph } from '../ui/BlockStack';
import { movedEnough, nearestSlot, slotsFromBlockRects } from './blockDrag';

// 팔레트/캔버스 블록 드래그의 상태·포인터 배선. 순수 스냅 판정은 blockDrag.ts.
//
//   - 팔레트 블록 pointerdown  → 새 블록을 들고 시작
//   - 떨어진 '종료' pointerdown → 그 블록을 들고 시작 (연결은 드래그로만, 클릭 아님)
//   - 포인터가 스택 슬롯에 가까워지면 스냅 인디케이터, 놓으면 그 자리에 삽입
//   - 조각 3 에서 스택 안 재정렬('stack' origin)·밖으로 빼서 삭제를 얹는다

export type DragOrigin = 'palette' | 'detached' | 'stack';

export type DragSource = {
  origin: DragOrigin;
  /** 드래그되는 블록. palette 는 새 인스턴스, 나머지는 기존 노드. */
  node: BlockNode;
};

type DragState = {
  source: DragSource;
  /** 현재 포인터 위치 (viewport) */
  pointer: { x: number; y: number };
  /** 블록을 잡은 지점의 오프셋 — 클론이 손끝을 따라오게 */
  grab: { x: number; y: number };
  /** 실제로 움직여서 드래그로 인정됐는지 */
  active: boolean;
  /** 스냅될 삽입 인덱스 (program.stack 기준) */
  slotIndex: number | null;
  /** 스냅 인디케이터 위치 (viewport) — 스택 왼쪽 x, 슬롯 중심 y */
  slot: { x: number; y: number } | null;
};

type BlockDragValue = {
  dragging: DragState | null;
  /** 소스 블록에서 드래그 시작 */
  startDrag: (source: DragSource, event: ReactPointerEvent) => void;
  /** 캔버스가 스택 컨테이너(<ol>)를 등록 — 슬롯 측정용 */
  registerStack: (el: HTMLElement | null) => void;
};

const BlockDragContext = createContext<BlockDragValue | null>(null);

export function useBlockDrag(): BlockDragValue {
  const ctx = useContext(BlockDragContext);
  if (!ctx) throw new Error('useBlockDrag 는 BlockDragProvider 안에서만 쓸 수 있어요.');
  return ctx;
}

type BlockDragProviderProps = {
  children: ReactNode;
  /** 스냅 슬롯에 드롭 — program.stack 의 slotIndex 위치에 삽입 */
  onInsert: (node: BlockNode, slotIndex: number) => void;
};

export function BlockDragProvider({ children, onInsert }: BlockDragProviderProps) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const stackRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef<DragState | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);

  const registerStack = useCallback((el: HTMLElement | null) => {
    stackRef.current = el;
  }, []);

  const commit = useCallback((next: DragState | null) => {
    stateRef.current = next;
    setDragging(next);
  }, []);

  const startDrag = useCallback(
    (source: DragSource, event: ReactPointerEvent) => {
      teardownRef.current?.();

      const rect = event.currentTarget.getBoundingClientRect();
      const start = { x: event.clientX, y: event.clientY };
      commit({
        source,
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
        const hit = nearestSlot(e.clientY, slotsFromBlockRects(rects));

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
        if (cur?.active && cur.slotIndex != null) onInsert(cur.source.node, cur.slotIndex);
        commit(null);
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
    [commit, onInsert],
  );

  useEffect(() => () => teardownRef.current?.(), []);

  const value = useMemo<BlockDragValue>(
    () => ({ dragging, startDrag, registerStack }),
    [dragging, startDrag, registerStack],
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
              <BlockGlyph node={dragging.source.node} />
            </div>,
            document.body,
          )
        : null}
    </BlockDragContext.Provider>
  );
}
