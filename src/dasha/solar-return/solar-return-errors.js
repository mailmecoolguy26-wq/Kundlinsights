'use strict';

class SolarReturnError extends Error {
  constructor(code, message) { super(message); this.name = 'SolarReturnError'; this.code = code; }
}

function fail(code, message) { throw new SolarReturnError(code, message); }

module.exports = { SolarReturnError, fail };
