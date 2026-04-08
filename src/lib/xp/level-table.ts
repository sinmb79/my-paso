export const LEVEL_THRESHOLDS = [
  0,
  100,
  250,
  500,
  800,
  1_200,
  1_700,
  2_300,
  3_000,
  3_800,
  4_700,
  5_700,
  6_800,
  8_000,
  9_300,
  10_700,
  12_200,
  13_800,
  15_500,
  17_300,
  19_200,
];

export function getLevelForXp(totalXp: number) {
  let level = 1;

  for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (totalXp >= LEVEL_THRESHOLDS[index]!) {
      level = index + 1;
    }
  }

  if (totalXp <= LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]!) {
    return level;
  }

  const overflowXp = totalXp - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]!;
  return LEVEL_THRESHOLDS.length + Math.floor(overflowXp / 2_500) + 1;
}
