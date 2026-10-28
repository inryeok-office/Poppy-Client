'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  DIFFICULTY_LABEL,
  RECOMMENDED_COMPOSITION,
  useMission,
  writeSelectedMissionId,
} from '@/features/mission';
import { clearLocalDraft } from '@/features/session';
import { PillButton, PoppyLogo } from '@/shared/ui';

// Server BlockType → 체험자에게 보여줄 블록 이름.
const BLOCK_LABEL: Record<string, string> = {
  WAIT: '기다리기',
  REPEAT: '반복하기',
  MOVE_FORWARD: '앞으로 이동',
  MOVE_BACKWARD: '뒤로 이동',
  TURN_LEFT: '왼쪽으로 회전',
  TURN_RIGHT: '오른쪽으로 회전',
  STOP: '정지',
  SIT: '앉기',
  STAND: '일어서기',
  PRESET: '특수 동작',
};

/** 미션 상세 — 목표·권장 구성·완료 조건·쓸 수 있는 블록을 보고 미션을 시작한다. */
export function MissionDetailView({ missionId }: { missionId: string }) {
  const router = useRouter();
  const mission = useMission(missionId);

  const start = () => {
    // 미션은 빈 캔버스(시작 → 종료)에서 시작한다.
    clearLocalDraft();
    writeSelectedMissionId(missionId);
    router.push('/experience');
  };

  return (
    <main className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col items-center gap-6 px-6 py-10">
      <header className="flex w-full max-w-2xl items-center justify-between">
        <Link href="/" aria-label="처음 화면으로">
          <PoppyLogo className="h-10 w-auto" />
        </Link>
        <Link href="/missions" className="text-muted text-[14px] underline">
          미션 목록으로
        </Link>
      </header>

      {mission.isPending && <p className="text-muted">미션을 불러오는 중이에요…</p>}
      {mission.isError && (
        <p role="alert" className="text-danger">
          미션을 찾지 못했어요. 목록에서 다시 골라 주세요.
        </p>
      )}

      {mission.data && (
        <article className="border-line bg-card flex w-full max-w-2xl flex-col gap-5 rounded-[16px] border p-8">
          <div className="flex items-center gap-3">
            <span className="bg-primary rounded-full px-3 py-1 text-[13px] text-white">
              난이도 {DIFFICULTY_LABEL[mission.data.difficulty]}
            </span>
            <h1 className="text-[24px]">{mission.data.title}</h1>
          </div>
          <p className="text-muted leading-relaxed">{mission.data.description}</p>

          <section aria-label="목표">
            <h2 className="mb-1 text-[16px]">목표</h2>
            <p>{mission.data.goal}</p>
          </section>

          {RECOMMENDED_COMPOSITION[mission.data.missionId] && (
            <section aria-label="권장 구성">
              <h2 className="mb-1 text-[16px]">권장 블록 구성</h2>
              <p className="text-muted">{RECOMMENDED_COMPOSITION[mission.data.missionId]}</p>
            </section>
          )}

          <section aria-label="완료 조건">
            <h2 className="mb-1 text-[16px]">완료 조건</h2>
            <ul className="text-muted list-disc pl-5">
              {mission.data.completionCondition.description
                .split('\n')
                .filter(Boolean)
                .map((line) => (
                  <li key={line}>{line}</li>
                ))}
            </ul>
          </section>

          <section aria-label="쓸 수 있는 블록">
            <h2 className="mb-1 text-[16px]">쓸 수 있는 블록</h2>
            <p className="text-muted">
              {mission.data.allowedBlocks.map((type) => BLOCK_LABEL[type] ?? type).join(' · ')}
            </p>
          </section>

          <p className="text-muted text-[13px]">
            미션 성공 여부는 실행이 끝난 뒤 진행요원과 함께 확인해요.
          </p>
          <div className="flex justify-end">
            <PillButton variant="primary" onClick={start}>
              이 미션 시작하기
            </PillButton>
          </div>
        </article>
      )}
    </main>
  );
}
