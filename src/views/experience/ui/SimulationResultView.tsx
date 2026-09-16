'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { PillButton, PoppyLogo } from '@/shared/ui';

import { readSimulationResult } from '../lib/simulationResultStorage';
import { unrollExecutionSteps, type BlockNode } from '../model/blockProgram';
import { BlockStack } from './BlockStack';

// Figma Slide 6(34:1350, 실패)·Slide 7(47:1733, 성공) — 시뮬레이션 결과 전용 화면.
// 명세 Simulation "시뮬레이션 실행"이 `페이지 필요: YES`로 바뀌어, 워크스페이스 안 텍스트
// 힌트 대신 이 화면이 결과를 보여준다. '블록 고치기'·'로봇 실행하기' 는 실제 실행 요청을
// 여기서 하지 않고 /experience 로 돌아간다 — ExperienceView 가 이 화면에서 남긴 결과를
// 다시 읽어(같은 program 이면) RunReadyWorkspace/BlockWorkspace 중 맞는 쪽을 그대로 이어 보여준다.

type StepStatus = '완료' | '문제 발생' | '대기';

function stepLabel(node: BlockNode): string {
  switch (node.kind) {
    case 'start':
      return '시작';
    case 'end':
      return '종료';
    case 'greet':
      return '인사하기';
    case 'sit':
      return '앉기';
    case 'standUp':
      return '일어서기';
    case 'heart':
      return '하트';
    case 'dance':
      return '춤추기';
    case 'rollOver':
      return '구르기';
    case 'attack':
      return '공격';
    case 'stop':
      return '정지';
    case 'wait':
      return `${node.seconds}초 기다리기`;
    case 'move':
      return `뒤로 ${node.distanceM}m 이동`;
    case 'moveForward':
      return `앞으로 ${node.distanceM}m 이동`;
    case 'turnRight':
      return `오른쪽으로 ${node.degrees}° 이동`;
    case 'turnLeft':
      return `왼쪽으로 ${node.degrees}° 이동`;
    case 'repeat':
      return `${node.count}번 반복하기`;
  }
}

const STATUS_BADGE: Record<StepStatus, string> = {
  완료: 'bg-success',
  '문제 발생': 'bg-danger',
  대기: 'bg-muted',
};

const STATUS_TEXT: Record<StepStatus, string> = {
  완료: 'text-muted',
  '문제 발생': 'text-danger',
  대기: 'text-muted',
};

export function SimulationResultView() {
  const router = useRouter();
  const stored = useMemo(() => readSimulationResult(), []);

  // 저장된 결과가 없으면(직접 주소 접근·새로고침 등) 볼 게 없다 — 조립 화면으로 돌려보낸다.
  useEffect(() => {
    if (!stored) router.replace('/experience');
  }, [stored, router]);

  if (!stored) return null;
  const { program, result } = stored;

  const steps = unrollExecutionSteps(program.stack);
  const total = steps.length;
  const failedIndex = result.failedAtIndex;

  const stepStatus = (i: number): StepStatus => {
    if (result.passed) return '완료';
    if (failedIndex == null) return '대기';
    if (i + 1 < failedIndex) return '완료';
    if (i + 1 === failedIndex) return '문제 발생';
    return '대기';
  };

  const progressRatio = result.passed
    ? 1
    : failedIndex != null && total > 0
      ? failedIndex / total
      : 0;
  const progressLabel = result.passed
    ? `${total}/${total} 단계 성공`
    : failedIndex != null
      ? `${failedIndex}번째 블록에서 멈춤`
      : '중단됨';

  const backToExperience = () => router.push('/experience');

  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <header className="border-line bg-page flex h-16 shrink-0 items-center border-b-[1.5px] pl-6">
        <PoppyLogo className="h-10 w-auto" />
      </header>

      <div className="flex flex-1 gap-16 py-8 pl-8">
        {/* 좌: 로봇 미리보기 (Figma 900×500 격자 박스 + 진행상태 + 스탯) */}
        <section className="w-[900px] shrink-0" aria-label="로봇 미리보기">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[16px]">로봇 미리보기</h2>
            {result.passed ? (
              <span className="text-success text-[16px]">성공</span>
            ) : (
              <span className="text-danger flex items-center gap-1 text-[16px]">
                <span
                  aria-hidden
                  className="bg-danger text-card inline-flex size-6 items-center justify-center rounded-full"
                >
                  !
                </span>
                실패
              </span>
            )}
          </div>

          <div
            role="img"
            aria-label="로봇 위치 미리보기 (2m × 2m 안전 구역)"
            className="border-line bg-card dot-grid relative mt-6 h-[500px] w-full overflow-hidden rounded-xl border"
          >
            <span className="text-muted absolute top-4 left-4 text-[12px]">2m x 2m 안전 구역</span>
            <span
              aria-hidden
              className="bg-ink absolute top-1/2 left-1/2 h-13 w-10 -translate-x-1/2 -translate-y-1/2 rounded-t-[18px] rounded-b-[7px]"
            />
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-start justify-between">
                <span className="text-[15px]">진행상태</span>
                <span className="text-[16px]">{progressLabel}</span>
              </div>
              {result.passed ? (
                <div className="bg-success h-2 w-full rounded-full" />
              ) : (
                <div className="relative h-2 w-full rounded-full bg-[#e4d5c6]">
                  <div
                    className="bg-danger absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${progressRatio * 100}%` }}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-[15px]">자세</span>
              <span className="text-[16px]">서있기</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-[15px]">바라보는 방향</span>
              <span className="text-[16px]">정면</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-[15px]">예상 이동 거리</span>
              <span className="text-[16px]">{result.totalDistanceM.toFixed(1)} m</span>
            </div>
          </div>
        </section>

        {/* 우: 결과 카드 + 실행순서 + 실행 블록 */}
        <section className="flex w-[586px] shrink-0 flex-col gap-6">
          {result.passed ? (
            <div className="bg-success-bg border-success flex flex-col gap-[15px] rounded-xl border p-4">
              <div className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="bg-success flex size-6 items-center justify-center rounded-full"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/experience/check-solid.svg" alt="" className="size-6" />
                </span>
                <p className="text-success text-[16px]">시뮬레이션 통과!</p>
              </div>
              <p className="text-[15px]">
                안전 범위 안에서 잘 움직였어요. 이제 실제 로봇으로 실행할 수 있어요.
              </p>
              <div className="flex gap-2">
                <PillButton onClick={backToExperience}>블록 고치기</PillButton>
                <PillButton variant="primary" onClick={backToExperience}>
                  로봇 실행하기
                </PillButton>
              </div>
            </div>
          ) : (
            <div className="bg-danger-bg border-danger flex flex-col gap-[15px] rounded-xl border p-4">
              <div className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="bg-danger text-card flex size-6 items-center justify-center rounded-full text-[16px]"
                >
                  !
                </span>
                <p className="text-danger text-[16px]">조금만 고치면 돼요!</p>
              </div>
              <p className="text-[15px] whitespace-pre-wrap">{result.violations[0]?.message}</p>
              <div className="flex gap-2">
                <PillButton variant="primary" onClick={backToExperience}>
                  블록 고치기
                </PillButton>
                <PillButton aria-disabled>
                  로봇 실행하기<span className="text-[13px]">• 잠김</span>
                </PillButton>
              </div>
            </div>
          )}

          <div className="flex gap-[60px]">
            <div className="flex w-[263px] flex-col gap-4">
              <h3 className="text-[16px]">실행순서</h3>
              <ol className="flex w-full flex-col gap-4" aria-label="실행순서">
                {steps.map((step, i) => {
                  const status = stepStatus(i);
                  return (
                    <li key={`${step.id}-${i}`} className="flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <span
                          aria-hidden
                          className={`text-card flex size-6 items-center justify-center rounded-full text-[16px] ${STATUS_BADGE[status]}`}
                        >
                          {i + 1}
                        </span>
                        <span className={status === '문제 발생' ? 'text-danger' : undefined}>
                          {stepLabel(step)}
                        </span>
                      </span>
                      <span className={`text-[15px] ${STATUS_TEXT[status]}`}>{status}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="flex w-[263px] flex-col gap-4">
              <h3 className="text-[16px]">실행 블록</h3>
              <BlockStack nodes={program.stack} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
