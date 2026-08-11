'use strict';

const { freeze } = require('./resolved-birth-place');

const TBB_2026C_1970_MANIFEST = freeze({
  datasetProvider: 'timezone-boundary-builder',
  datasetFamily: '1970',
  datasetVersion: '2026c',
  datasetChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16',
  geometryFormat: 'GeoJSON',
  sourceStatus: 'APPROVED_OFFLINE_DATASET',
  artifactFileName: 'timezones-1970.geojson.zip',
  artifactByteLength: 44962094,
  artifactChecksum: 'c1bd0839c15a94ace5107e84694915fca3ab74907dee7b2ed4e3e5e01acc8f16',
  extractedGeometryFileName: 'combined-1970.json',
  geometryByteLength: 149581087,
  geometryChecksum: '3ccc7784a2ec07b132db7e27e837a156bc7e100ab93d9fa062bd74f79f9a40bb',
  sourceReleaseId: '2026c',
});

module.exports = { TBB_2026C_1970_MANIFEST };
