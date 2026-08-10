'use strict';

function normalizeLongitude(degrees) { return ((degrees % 360) + 360) % 360; }

class SiderealCalculator {
  calculateSiderealLongitude(_request) { throw new Error('SiderealCalculator.calculateSiderealLongitude must be implemented.'); }
}

// Temporary development-only approximation. It must be replaced by Swiss Ephemeris SE_SIDM_LAHIRI.
function interimLahiriAyanamsha(instant) {
  const yearStart = Date.UTC(instant.getUTCFullYear(), 0, 1);
  const nextYear = Date.UTC(instant.getUTCFullYear() + 1, 0, 1);
  const decimalYear = instant.getUTCFullYear() + (instant.getTime() - yearStart) / (nextYear - yearStart);
  return 22.46047222222222 + ((decimalYear - 1900) * 50.2564) / 3600;
}

class InterimLahiriSiderealCalculator extends SiderealCalculator {
  calculateSiderealLongitude({ tropicalLongitudeDegrees, instant, ayanamshaSystem }) {
    if (ayanamshaSystem !== 'Lahiri / Chitrapaksha') throw new TypeError('InterimLahiriSiderealCalculator supports only Lahiri / Chitrapaksha.');
    const ayanamshaValueDegrees = interimLahiriAyanamsha(instant);
    return {
      siderealLongitudeDegrees: normalizeLongitude(tropicalLongitudeDegrees - ayanamshaValueDegrees),
      metadata: {
        system: 'Lahiri / Chitrapaksha',
        implementation: 'interim-linear',
        reference: 'KundlInsights interim linear formula, epoch 1900.0; not Swiss Ephemeris validated',
        ayanamshaValueDegrees,
        calculationInstant: instant.toISOString(),
        provisional: true,
        calculationStatus: 'PROVISIONAL'
      }
    };
  }
}

module.exports = { SiderealCalculator, InterimLahiriSiderealCalculator, interimLahiriAyanamsha, normalizeLongitude };
