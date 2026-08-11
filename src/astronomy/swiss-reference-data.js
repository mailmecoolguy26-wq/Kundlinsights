'use strict';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const SWISS_BINDING = deepFreeze({ name: 'sweph', version: '2.10.3-7', architecture: 'node-api' });
const SWISS_VERSION = '2.10.03';
const CALCULATION_STATUS = 'LICENSE_GATED_VALIDATION';
const STATIONARY_SPEED_THRESHOLD_DEGREES_PER_DAY = 1e-7;
const BODY_CONSTANT_NAMES = deepFreeze({ Sun: 'SE_SUN', Moon: 'SE_MOON', Mars: 'SE_MARS', Mercury: 'SE_MERCURY', Jupiter: 'SE_JUPITER', Venus: 'SE_VENUS', Saturn: 'SE_SATURN', Rahu: 'SE_MEAN_NODE' });
const REQUIRED_BODY_NAMES = deepFreeze([...Object.keys(BODY_CONSTANT_NAMES), 'Ketu', 'Ascendant']);
const REQUIRED_MANIFEST_FILES = deepFreeze(['sepl_18.se1', 'semo_18.se1']);

module.exports = deepFreeze({ SWISS_BINDING, SWISS_VERSION, CALCULATION_STATUS, STATIONARY_SPEED_THRESHOLD_DEGREES_PER_DAY, BODY_CONSTANT_NAMES, REQUIRED_BODY_NAMES, REQUIRED_MANIFEST_FILES });
