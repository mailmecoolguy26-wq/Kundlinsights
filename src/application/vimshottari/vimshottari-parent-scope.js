'use strict';

function byExactStart(periods, start) { return periods.find((period) => BigInt(period.startInstant.epochMilliseconds) === start.epochMilliseconds) || null; }
function resolveMahadashaByStart(periods, start) { return byExactStart(periods, start); }
function resolveAntardashaByStart(mahadasha, start) { return mahadasha ? byExactStart(mahadasha.children, start) : null; }
function resolvePratyantarByStart(dasha, start) {
  for (const mahadasha of dasha.periods) for (const antardasha of mahadasha.children) {
    const index = antardasha.children.findIndex((period) => BigInt(period.startInstant.epochMilliseconds) === start.epochMilliseconds);
    if (index >= 0) return Object.freeze({ mahadasha, antardasha, pratyantar: antardasha.children[index], nextPratyantar: antardasha.children[index + 1] || null });
  }
  return null;
}
function contained(children, parent) { const start = BigInt(parent.startInstant.epochMilliseconds); const end = BigInt(parent.endInstant.epochMilliseconds); return children.every((child) => BigInt(child.startInstant.epochMilliseconds) >= start && BigInt(child.endInstant.epochMilliseconds) <= end); }
module.exports = { resolveMahadashaByStart, resolveAntardashaByStart, resolvePratyantarByStart, contained };
