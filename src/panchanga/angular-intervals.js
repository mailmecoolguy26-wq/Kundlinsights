'use strict';

function normalizeDegrees(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Longitude must be a finite number.');
  return ((value % 360) + 360) % 360;
}

function classifyEqualInterval(normalizedDegrees, divisions) {
  const width = 360 / divisions;
  const raw = normalizedDegrees / width;
  const nearest = Math.round(raw);
  const atBoundary = Math.abs(raw - nearest) <= Number.EPSILON * 128;
  const snapped = atBoundary ? nearest : raw;
  const completed = Math.min(divisions - 1, Math.floor(snapped));
  const degreesElapsed = atBoundary ? 0 : normalizedDegrees - (completed * width);
  return { index: completed + 1, width, degreesElapsed, degreesRemaining: width - degreesElapsed, progressRatio: degreesElapsed / width, boundaryStatus: atBoundary ? 'exactBoundary' : 'withinInterval' };
}

module.exports = { normalizeDegrees, classifyEqualInterval };
