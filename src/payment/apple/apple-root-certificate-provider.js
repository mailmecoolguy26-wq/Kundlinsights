'use strict';
const fs = require('node:fs');
class AppleRootCertificateProvider {
  constructor({ paths } = {}) { this.paths = Array.isArray(paths) ? paths : []; }
  load() {
    if (!this.paths.length) { const error = new Error('APPLE_ROOT_CERTIFICATES_MISSING'); error.code = 'APPLE_ROOT_CERTIFICATES_MISSING'; throw error; }
    try { return this.paths.map((path) => fs.readFileSync(path)); }
    catch { const error = new Error('APPLE_ROOT_CERTIFICATES_MISSING'); error.code = 'APPLE_ROOT_CERTIFICATES_MISSING'; throw error; }
  }
}
module.exports = { AppleRootCertificateProvider };
