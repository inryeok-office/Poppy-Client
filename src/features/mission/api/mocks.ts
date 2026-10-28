import { HttpResponse, http } from 'msw';

import type { MissionDetail } from '../model/types';

// 개발·테스트용 미션 (Server MissionCatalog 와 같은 ID·내용 일부).
export const MOCK_MISSIONS: MissionDetail[] = [
  {
    missionId: 'f3f450e4-8faf-4d2e-b2aa-6f76ac115412',
    title: '로봇 택배 배달',
    difficulty: 'EASY',
    description: 'GO2가 출발선에서 앞의 배송 지점까지 이동해 멈추면 성공하는 가장 기본적인 미션.',
    goal: '앞으로 이동해 지정된 도착 지점에서 정지한다.',
    completionCondition: {
      description:
        '지정된 이동 거리 범위 안에서 전진 명령이 실행됨\n마지막 명령이 정지 상태로 종료됨',
    },
    timeLimitSeconds: null,
    allowedBlocks: ['MOVE_FORWARD', 'STOP'],
  },
  {
    missionId: '070cc084-7085-4d78-af20-fa8802feec0b',
    title: '편의점 심부름',
    difficulty: 'NORMAL',
    description: '앞으로 이동한 뒤 코너를 돌아 목적지까지 가는 ㄱ자 경로 미션.',
    goal: '전진과 회전을 조합해 두 구간의 경로를 완성한다.',
    completionCondition: { description: '첫 번째 이동, 회전, 두 번째 이동 순서가 모두 충족' },
    timeLimitSeconds: null,
    allowedBlocks: ['MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'STOP'],
  },
  {
    missionId: 'fca33818-b066-44de-be7d-8afd113e47a9',
    title: '사각 순찰대',
    difficulty: 'HARD',
    description: '반복 블록을 이용해 네 변을 도는 사각형 순찰 경로를 만드는 미션.',
    goal: '반복 블록으로 `전진 + 회전` 패턴을 압축해 사각 경로를 완주한다.',
    completionCondition: { description: '반복 블록 사용 필수\n네 번의 이동·회전 패턴 완료' },
    timeLimitSeconds: null,
    allowedBlocks: ['REPEAT', 'MOVE_FORWARD', 'TURN_LEFT', 'TURN_RIGHT', 'STOP'],
  },
];

const ok = <T>(data: T) => HttpResponse.json({ success: true, data, error: null });

export const missionHandlers = [
  http.get('*/api/v1/missions', () =>
    ok({
      missions: MOCK_MISSIONS.map(({ missionId, title, difficulty, description }) => ({
        missionId,
        title,
        difficulty,
        summary: description,
        estimatedSeconds: null,
      })),
    }),
  ),
  http.get('*/api/v1/missions/:missionId', ({ params }) => {
    const mission = MOCK_MISSIONS.find((m) => m.missionId === params.missionId);
    return mission
      ? ok(mission)
      : HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'MISSION_NOT_FOUND', message: 'not found' },
          },
          { status: 404 },
        );
  }),
];
