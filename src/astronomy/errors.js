'use strict';

class InputValidationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'InputValidationError';
    this.code = code;
  }
}

class ProductionLicenseGateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductionLicenseGateError';
  }
}

module.exports = { InputValidationError, ProductionLicenseGateError };
