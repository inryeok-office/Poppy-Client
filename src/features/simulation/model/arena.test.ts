import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ARENA,
  arenaFromResponse,
  moveRangeFor,
  type ArenaSettingsResponse,
} from './arena';

const booth: ArenaSettingsResponse = {
  presetCode: '3x3-부스',
  widthM: 3,
  depthM: 3,
  marginM: 0.5,
  startXM: 2.5,
  startYM: 0.5,
  startHeading: '+Y',
  limits: { usableWidthM: 2, usableDepthM: 2, maxMovePerCommandM: 1.2, defaultMoveDistanceM: 0.5 },
};

describe('arenaFromResponse', () => {
  it('3×3 부스 응답을 그대로 받는다', () => {
    expect(arenaFromResponse(booth)).toEqual({
      presetCode: '3x3-부스',
      widthM: 3,
      depthM: 3,
      marginM: 0.5,
      startXM: 2.5,
      startYM: 0.5,
      startHeadingDegrees: 0,
      maxMovePerCommandM: 1.2,
      defaultMoveDistanceM: 0.5,
    });
  });

  it('6×6 박람회 응답은 기본값과 같다', () => {
    const expo: ArenaSettingsResponse = {
      presetCode: '6x6-박람회',
      widthM: 6,
      depthM: 6,
      marginM: 0.4,
      startXM: 5.6,
      startYM: 0.4,
      startHeading: '+Y',
      limits: {
        usableWidthM: 5.2,
        usableDepthM: 5.2,
        maxMovePerCommandM: 3,
        defaultMoveDistanceM: 1,
      },
    };
    expect(arenaFromResponse(expo)).toEqual(DEFAULT_ARENA);
  });

  it('출발 방향은 도(°)로 바뀐다', () => {
    expect(arenaFromResponse({ ...booth, startHeading: '+X' })?.startHeadingDegrees).toBe(90);
    expect(arenaFromResponse({ ...booth, startHeading: '-Y' })?.startHeadingDegrees).toBe(180);
  });

  it('안전 경계를 넓히거나 이상한 응답은 거부한다(호출한 쪽이 6×6 으로 되돌아간다)', () => {
    expect(arenaFromResponse(null)).toBeNull();
    expect(arenaFromResponse({})).toBeNull();
    expect(arenaFromResponse({ ...booth, widthM: 7 })).toBeNull(); // 한 변 6 m 초과
    expect(arenaFromResponse({ ...booth, marginM: 0.3 })).toBeNull(); // 벽 여유 0.4 m 미만
    expect(arenaFromResponse({ ...booth, startXM: 0.2 })).toBeNull(); // 출발점이 여유 밖
    expect(arenaFromResponse({ ...booth, startHeading: 'up' })).toBeNull();
    expect(arenaFromResponse({ ...booth, widthM: Number.NaN })).toBeNull();
    // 1회 이동 한도가 3 m 초과이거나 가용 영역(2.0 m)보다 큰 값
    expect(
      arenaFromResponse({ ...booth, limits: { ...booth.limits, maxMovePerCommandM: 3.5 } }),
    ).toBeNull();
    expect(
      arenaFromResponse({ ...booth, limits: { ...booth.limits, maxMovePerCommandM: 2.5 } }),
    ).toBeNull();
    expect(
      arenaFromResponse({ ...booth, limits: { ...booth.limits, defaultMoveDistanceM: 2 } }),
    ).toBeNull();
  });

  it('이동 블록 입력 범위의 최대값이 공간을 따른다', () => {
    expect(moveRangeFor(DEFAULT_ARENA)).toEqual({ min: 0.1, max: 3, step: 0.1 });
    expect(moveRangeFor(arenaFromResponse(booth)!)).toEqual({ min: 0.1, max: 1.2, step: 0.1 });
  });
});
