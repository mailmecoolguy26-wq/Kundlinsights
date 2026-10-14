'use strict';
const { immutableCopy, repositoryError } = require('../../persistence/contracts');
const { CAREER_READING_INTERPRETATION_SCHEMA_VERSION, CAREER_READING_OUTPUT_VALIDATOR_VERSION } = require('./career-reading-output-validator');
const { buildCareerEvidenceSynthesis } = require('../insights/career-evidence-synthesis');
function fail(code) { throw repositoryError(code); }
class CalibratedCareerReadingGenerator {
  constructor({ baseGenerator, careerReadingContextBuilder, careerReadingInterpreter } = {}) { if (!baseGenerator || typeof baseGenerator.generate !== 'function' || !careerReadingContextBuilder || !careerReadingInterpreter) fail('INVALID_CALIBRATED_CAREER_READING_GENERATOR'); this.base = baseGenerator; this.builder = careerReadingContextBuilder; this.interpreter = careerReadingInterpreter; }
  async generate({ principal, birthProfile, domain, readingInstant, locale, diagnosticLog = null } = {}) {
    let base;
    try {
      base = await this.base.generate({ birthProfile, domain, readingInstant, locale });
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_CALCULATION', state: 'BASE_ASTROLOGY_SUCCEEDED' });
    } catch (error) {
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_CALCULATION', state: 'BASE_ASTROLOGY_FAILED', safeErrorCode: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR', errorClass: typeof error.name === 'string' ? error.name : 'Error' });
      throw error;
    }
    if (domain !== 'CAREER') return base;
    let context;
    try {
      context = await this.builder.build({ principal, birthProfileId: birthProfile.id });
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_HISTORY', state: 'CONTEXT_BUILT' });
    } catch (error) {
      if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_HISTORY', state: 'FAILED', safeErrorCode: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR', errorClass: typeof error.name === 'string' ? error.name : 'Error' });
      throw error;
    }
    const interpretation = await this.interpreter.interpretContext(context, { diagnosticLog });
    const calibrationMetadata = { contextVersion: context.contextVersion, selectionPolicyVersion: context.selectionPolicyVersion, interpretationSchemaVersion: CAREER_READING_INTERPRETATION_SCHEMA_VERSION, validatorVersion: CAREER_READING_OUTPUT_VALIDATOR_VERSION, calibrationLevel: context.calibrationLevel, sourceEventIds: context.sourceEventIds, historicalEvidenceIds: context.historicalEvidence.map((item) => item.evidenceId), futureEvidenceIds: context.futureOccurrences.map((item) => item.evidenceId), compositeEvidenceIds: context.composites.map((item) => item.evidenceId), rulesets: context.rulesets, hasProvisionalEvidence: context.calculationBasis.hasProvisionalEvidence };
    const calibrationSummary = interpretation && interpretation.calibrationSummary;
    const careerEvidenceSynthesis = buildCareerEvidenceSynthesis({
      insights: base.result.reading.insights,
      careerAshtakavargaCorroboration: base.result.reading.careerAshtakavargaCorroboration,
      calibrationSummary,
    });
    return immutableCopy({ input: base.input, result: { ...base.result, reading: { ...base.result.reading, calibrationInterpretation: interpretation, ...(careerEvidenceSynthesis ? { careerEvidenceSynthesis } : {}) }, provenance: { ...base.result.provenance, calibrationMetadata } } });
  }
}
module.exports = { CalibratedCareerReadingGenerator };
