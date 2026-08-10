'use strict';

class EphemerisProvider {
  calculate(_instant) { throw new Error('EphemerisProvider.calculate must be implemented.'); }
}

module.exports = { EphemerisProvider };
