'use strict';

const { RASHI_DEFINITIONS, PLANETARY_TARGET_ORDER } = require('./reference-data');

const DEFAULT_PINDA_RULESET_ID = 'parashari-pinda-bphs-santhanam-chakra-v1';
const BPHS_PINDA_RULESET_ID = DEFAULT_PINDA_RULESET_ID;
const PHALADEEPIKA_PINDA_RULESET_ID = 'phaladeepika-pinda-v-subrahmanya-sastri-v1';
const GRAHA_MULTIPLIERS = Object.freeze({ Sun: 5, Moon: 5, Mars: 8, Mercury: 5, Jupiter: 10, Venus: 7, Saturn: 5 });

function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; Object.freeze(value); Object.values(value).forEach(freeze); return value; }
function ruleset({ id, rashiMultipliers, source }) { return freeze({ id, rashiMultipliers: Object.freeze(rashiMultipliers), grahaMultipliers: GRAHA_MULTIPLIERS, source }); }

const PINDA_RULESETS = freeze({
  [BPHS_PINDA_RULESET_ID]: ruleset({
    id: BPHS_PINDA_RULESET_ID,
    rashiMultipliers: [7, 10, 8, 4, 10, 6, 7, 8, 9, 5, 11, 12],
    source: { rashiMultipliers: 'BPHS-Santhanam-Rashiman-Chakra', grahaMultipliers: 'BPHS-Santhanam-Planetman-Chakra-independently-corroborated-by-Phaladeepika', santhanamProseConflict: 'recorded-not-selected' },
  }),
  [PHALADEEPIKA_PINDA_RULESET_ID]: ruleset({
    id: PHALADEEPIKA_PINDA_RULESET_ID,
    rashiMultipliers: [7, 10, 8, 4, 10, 5, 7, 8, 9, 5, 11, 12],
    source: { rashiMultipliers: 'Phaladeepika-V-Subrahmanya-Sastri', grahaMultipliers: 'Phaladeepika-V-Subrahmanya-Sastri' },
  }),
});

function validMultiplier(value) { return Number.isInteger(value) && Number.isFinite(value) && value > 0; }
function validatePindaRulesets(rulesets = PINDA_RULESETS) {
  if (!rulesets || typeof rulesets !== 'object' || Object.keys(rulesets).length !== 2) throw new TypeError('Pinda rulesets must contain exactly the two approved versioned rulesets.');
  for (const id of [BPHS_PINDA_RULESET_ID, PHALADEEPIKA_PINDA_RULESET_ID]) {
    const entry = rulesets[id];
    if (!entry || entry.id !== id || !Array.isArray(entry.rashiMultipliers) || entry.rashiMultipliers.length !== RASHI_DEFINITIONS.length || entry.rashiMultipliers.some((value) => !validMultiplier(value))) throw new TypeError(`Invalid Rashi multiplier table for ${id}.`);
    if (!entry.grahaMultipliers || Object.keys(entry.grahaMultipliers).length !== PLANETARY_TARGET_ORDER.length || PLANETARY_TARGET_ORDER.some((body) => !validMultiplier(entry.grahaMultipliers[body]))) throw new TypeError(`Invalid Graha multiplier table for ${id}.`);
  }
  const bphs = rulesets[BPHS_PINDA_RULESET_ID]; const phala = rulesets[PHALADEEPIKA_PINDA_RULESET_ID];
  if (bphs.rashiMultipliers[5] !== 6 || phala.rashiMultipliers[5] !== 5 || bphs.rashiMultipliers.some((value, index) => index !== 5 && value !== phala.rashiMultipliers[index])) throw new TypeError('Approved Pinda rulesets must differ only at Kanya.');
  if (PLANETARY_TARGET_ORDER.some((body) => bphs.grahaMultipliers[body] !== phala.grahaMultipliers[body])) throw new TypeError('Approved Pinda Graha multiplier tables must match.');
  return true;
}

validatePindaRulesets();
function getPindaRuleset(rulesetId = DEFAULT_PINDA_RULESET_ID) {
  const ruleset = PINDA_RULESETS[rulesetId];
  if (!ruleset) throw new RangeError(`Unsupported Pinda ruleset: ${rulesetId}`);
  return ruleset;
}

module.exports = { DEFAULT_PINDA_RULESET_ID, BPHS_PINDA_RULESET_ID, PHALADEEPIKA_PINDA_RULESET_ID, GRAHA_MULTIPLIERS, PINDA_RULESETS, validatePindaRulesets, getPindaRuleset };
