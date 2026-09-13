'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collect, audit, candidateStructure, countedHouse, sampleProfiles } = require('../../scripts/research/ashtakavarga-career-audit');

test('analysis-only Ashtakavarga audit is deterministic and uses a broad non-PII sample', async () => {
  const samples = sampleProfiles(100);
  assert.equal(samples.length, 100);
  assert.ok(new Set(samples.map((item) => item.birthData.localDate)).size > 80);
  assert.ok(new Set(samples.map((item) => `${item.birthData.latitude}|${item.birthData.longitude}`)).size >= 6);
  const first = audit(await collect({ count: 24 }));
  const second = audit(await collect({ count: 24 }));
  assert.deepEqual(first, second);
  assert.equal(first.distributions.h10Sav.count, 24);
  assert.equal(first.candidateStructure.distributions.h10LordHouseSav.count, 24);
  assert.equal(first.candidateStructure.referenceBands.h10Sav[28].below + first.candidateStructure.referenceBands.h10Sav[28].equal + first.candidateStructure.referenceBands.h10Sav[28].above, 24);
  assert.equal(first.recommendation.option, 'A');
});

test('candidate Career structure is deterministic, wraps tenth-from-lord house, and remains calculation-only', async () => {
  assert.equal(countedHouse(1, 10), 10);
  assert.equal(countedHouse(12, 10), 9);
  assert.equal(countedHouse(0, 10), null);
  const [record] = await collect({ count: 1 });
  const structure = candidateStructure({
    houses: {
      houses: [
        { houseNumber: 7, rashi: { rashiIndex: 7 }, rashiHouseLord: { name: 'Venus' } },
        { houseNumber: 10, rashi: { rashiIndex: 10 }, rashiHouseLord: { name: 'Saturn' } },
      ],
      planetaryAssignments: [
        { body: 'Saturn', rashiHouseNumber: 12 },
        { body: 'Venus', rashiHouseNumber: 3 },
      ],
    },
    sav: new Map([[7, 29], [10, 31]]),
  });
  assert.deepEqual(structure, {
    h10Sav: 31,
    h10Lord: 'Saturn',
    h10LordHouse: 12,
    h10LordHouseSav: null,
    h7Sav: 29,
    h7Lord: 'Venus',
    h7LordHouse: 3,
    h7LordHouseSav: null,
    tenthFromH10LordHouse: 9,
    tenthFromH10LordHouseSav: null,
  });
  assert.ok(record.candidate.h10Lord);
  assert.equal(Object.isFrozen(record.candidate), true);
});

test('production source does not import research tooling', () => {
  const files = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
  const source = files(path.join(__dirname, '../../src')).filter((file) => file.endsWith('.js')).map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.equal(source.includes('scripts/research'), false);
});
