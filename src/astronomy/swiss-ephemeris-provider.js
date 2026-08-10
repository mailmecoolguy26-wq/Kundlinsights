'use strict';

const { EphemerisProvider } = require('./ephemeris-provider');
const { ProductionLicenseGateError } = require('./errors');

class SwissEphemerisProvider extends EphemerisProvider {
  constructor() { super(); throw new ProductionLicenseGateError('SwissEphemerisProvider is blocked: record an executed Swiss Ephemeris Professional License and approved provider/data versions before enabling it. AGPL Swiss Ephemeris code/data must not be added to this repository as a production dependency.'); }
}

module.exports = { SwissEphemerisProvider };
