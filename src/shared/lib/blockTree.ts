// 블록류 트리(반복 블록이 body 를 갖고 count 번 반복하는 구조) 순회를 한 곳에 모은다.
// features/simulation 의 SerializedBlockNode, views/experience 의 BlockNode 는 서로 다른
// (독립적으로 선언된) 타입이지만 모양이 같아 이 제네릭 순회 하나를 공유할 수 있다.
// 정규화 명령 수 세기 · 안전 제한 값 검증 · 반복 중첩 이동 거리 합산 · 특정 종류 개수 세기가
// 전부 "노드마다 값을 더하고, 반복이면 body 를 배수만큼 곱해 재귀"라는 같은 모양이라
// repeatCountOf 를 1로 두면 배수 없는 구조적 세기가, count 를 그대로 두면 반복 적용 합산이 된다.

export type BlockTreeWalk<T> = {
  /** 이 노드 하나가 더할 값 (반복 블록 자신의 값이 필요하면 여기서 kind 로 분기) */
  valueOf: (node: T) => number;
  /** 이 노드가 반복 컨테이너면 그 body, 아니면 undefined */
  bodyOf: (node: T) => readonly T[] | undefined;
  /** 이 노드가 반복 컨테이너일 때 재귀에 곱할 배수 (구조적으로만 세려면 항상 1을 반환) */
  repeatCountOf: (node: T) => number;
};

export function sumOverBlockTree<T>(nodes: readonly T[], walk: BlockTreeWalk<T>): number {
  const { valueOf, bodyOf, repeatCountOf } = walk;
  const step = (list: readonly T[], multiplier: number): number =>
    list.reduce((sum, node) => {
      const body = bodyOf(node);
      const nested = body ? step(body, multiplier * repeatCountOf(node)) : 0;
      return sum + valueOf(node) * multiplier + nested;
    }, 0);
  return step(nodes, 1);
}
