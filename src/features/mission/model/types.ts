// 미션 API 계약 (Poppy-Server MissionController, GET /api/v1/missions · /{missionId}).

export type MissionDifficulty = 'EASY' | 'NORMAL' | 'HARD';

export const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  EASY: '하',
  NORMAL: '중',
  HARD: '상',
};

export const DIFFICULTY_ORDER: MissionDifficulty[] = ['EASY', 'NORMAL', 'HARD'];

export type MissionSummary = {
  missionId: string;
  title: string;
  difficulty: MissionDifficulty;
  summary: string;
  estimatedSeconds: number | null;
};

export type MissionDetail = {
  missionId: string;
  title: string;
  difficulty: MissionDifficulty;
  description: string;
  goal: string;
  completionCondition: { description: string };
  timeLimitSeconds: number | null;
  /** Server BlockType 이름 (START·END 제외, 예: MOVE_FORWARD, TURN_LEFT, PRESET) */
  allowedBlocks: string[];
};
