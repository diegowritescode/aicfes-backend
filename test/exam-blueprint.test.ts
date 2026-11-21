import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  EXAM_BLUEPRINT,
  TOTAL_QUESTIONS,
  minutesFor,
  scaleBlueprint,
} from '../src/simulacro/exam-blueprint';

/**
 * A practice sitting is only useful if its proportions match the real
 * exam, so the scaling arithmetic is pinned here.
 */

test('the blueprint matches the real sitting', () => {
  assert.equal(TOTAL_QUESTIONS, 254);
  assert.equal(EXAM_BLUEPRINT.length, 5);
  assert.equal(EXAM_BLUEPRINT.find((a) => a.area === 'CN')?.questions, 58);
});

test('a scaled sitting sums to exactly what was asked for', () => {
  // Rounding each area independently loses or gains questions; the
  // remainders have to be handed back out.
  for (const total of [10, 20, 25, 33, 50, 77, 100, 254]) {
    const scaled = scaleBlueprint(total);
    const sum = scaled.reduce((s, a) => s + a.scaled, 0);
    assert.equal(sum, total, `${total} questions should sum exactly`);
  }
});

test('every area keeps at least one question, however short the sitting', () => {
  const scaled = scaleBlueprint(5);
  assert.equal(scaled.length, 5);
  for (const area of scaled) {
    assert.ok(area.scaled >= 1, `${area.area} should not vanish`);
  }
});

test('at full length a scaled sitting is the real one', () => {
  const scaled = scaleBlueprint(254);
  for (const area of scaled) {
    assert.equal(area.scaled, area.questions, `${area.area} should be unchanged`);
  }
});

test('the larger areas stay larger after scaling', () => {
  const scaled = scaleBlueprint(50);
  const cn = scaled.find((a) => a.area === 'CN')?.scaled ?? 0;
  const lc = scaled.find((a) => a.area === 'LC')?.scaled ?? 0;
  // Ciencias Naturales is the longest area in the real exam.
  assert.ok(cn > lc, 'CN (58) should outweigh LC (41)');
});

test('time scales with length at the real exam pace', () => {
  assert.equal(minutesFor(254), 540);
  assert.ok(minutesFor(50) < minutesFor(100));
  assert.ok(minutesFor(50) > 0);
});
