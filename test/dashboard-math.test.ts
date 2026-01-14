import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  calculateAreaProgress,
  calculateLevel,
  calculateStreak,
} from '../src/dashboard/utils/dashboard-math';

test('calculateLevel derives level and progress from XP', () => {
  const result = calculateLevel(1240);

  assert.equal(result.level, 3);
  assert.equal(result.totalXp, 1240);
  assert.equal(result.currentXp, 240);
  assert.equal(result.nextLevelXp, 500);
});

test('calculateStreak counts consecutive study days', () => {
  const result = calculateStreak(
    ['2024-10-01', '2024-10-02', '2024-10-03'],
    '2024-10-03',
  );

  assert.equal(result.currentDays, 3);
  assert.equal(result.longestDays, 3);
  assert.equal(result.lastStudyDate, '2024-10-03');
  assert.equal(result.nextMilestoneDays, 7);
});

test('calculateStreak resets when the user missed a day', () => {
  const result = calculateStreak(
    ['2024-10-01', '2024-10-02'],
    '2024-10-04',
  );

  assert.equal(result.currentDays, 0);
  assert.equal(result.longestDays, 2);
});

test('calculateAreaProgress aggregates weekly accuracy by area', () => {
  const result = calculateAreaProgress([
    { area: 'MAT', totalQuestions: 5, correctQuestions: 3 },
    { area: 'LC', totalQuestions: 2, correctQuestions: 1 },
  ]);

  const mat = result.find((entry) => entry.area === 'MAT');
  const lc = result.find((entry) => entry.area === 'LC');
  const cn = result.find((entry) => entry.area === 'CN');

  assert.equal(mat?.accuracy, 60);
  assert.equal(mat?.questions, 5);
  assert.equal(lc?.accuracy, 50);
  assert.equal(lc?.questions, 2);
  assert.equal(cn?.accuracy, 0);
  assert.equal(cn?.questions, 0);
});
