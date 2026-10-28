'use client';

import Link from 'next/link';

import {
  DIFFICULTY_LABEL,
  DIFFICULTY_ORDER,
  useMissions,
  type MissionSummary,
} from '@/features/mission';
import { PoppyLogo } from '@/shared/ui';

/** 미션 목록 — 난이도 하·중·상으로 묶어 보여주고, 고르면 미션 상세로 간다. */
export function MissionListView() {
  const missions = useMissions();

  return (
    <main className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col items-center gap-8 px-6 py-10">
      <header className="flex w-full max-w-4xl items-center justify-between">
        <Link href="/" aria-label="처음 화면으로">
          <PoppyLogo className="h-10 w-auto" />
        </Link>
        <Link href="/experience" className="text-muted text-[14px] underline">
          미션 없이 자유 체험하기
        </Link>
      </header>
      <h1 className="text-[24px]">미션을 하나 골라 주세요</h1>

      {missions.isPending && <p className="text-muted">미션을 불러오는 중이에요…</p>}
      {missions.isError && (
        <p role="alert" className="text-danger">
          미션 목록을 불러오지 못했어요. 잠시 후 다시 시도하거나 진행요원에게 알려 주세요.
        </p>
      )}

      {missions.data && (
        <div className="grid w-full max-w-4xl gap-6 md:grid-cols-3">
          {DIFFICULTY_ORDER.map((difficulty) => {
            const group = missions.data.filter((m) => m.difficulty === difficulty);
            return (
              <section key={difficulty} aria-label={`난이도 ${DIFFICULTY_LABEL[difficulty]}`}>
                <h2 className="text-muted mb-3 text-[15px]">
                  난이도 {DIFFICULTY_LABEL[difficulty]}
                </h2>
                <ul className="flex flex-col gap-3">
                  {group.map((mission) => (
                    <MissionCard key={mission.missionId} mission={mission} />
                  ))}
                  {group.length === 0 && <li className="text-muted text-[14px]">준비 중이에요</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function MissionCard({ mission }: { mission: MissionSummary }) {
  return (
    <li>
      <Link
        href={`/missions/${mission.missionId}`}
        className="border-line bg-card hover:border-ink flex flex-col gap-2 rounded-[12px] border p-4 transition-colors"
      >
        <span className="text-[17px]">{mission.title}</span>
        <span className="text-muted text-[13px] leading-snug">{mission.summary}</span>
      </Link>
    </li>
  );
}
