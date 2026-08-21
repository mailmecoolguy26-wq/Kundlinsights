'use strict';
const { immutableCopy, repositoryError } = require('../../persistence/contracts');
const { CAREER_READING_INTERPRETATION_SCHEMA_VERSION, CAREER_READING_OUTPUT_VALIDATOR_VERSION } = require('./career-reading-output-validator');
function fail(code) { throw repositoryError(code); }
class CalibratedCareerReadingGenerator {
  constructor({ baseGenerator, careerReadingContextBuilder, careerReadingInterpreter } = {}) { if (!baseGenerator || typeof baseGenerator.generate !== 'function' || !careerReadingContextBuilder || !careerReadingInterpreter) fail('INVALID_CALIBRATED_CAREER_READING_GENERATOR'); this.base = baseGenerator; this.builder = careerReadingContextBuilder; this.interpreter = careerReadingInterpreter; }
  async generate({ principal, birthProfile, domain, readingInstant, locale } = {}) {
    const base = await this.base.generate({ birthProfile, domain, readingInstant, locale });
    if (domain !== 'CAREER') return base;
    const context = await this.builder.build({ principal, birthProfileId: birthProfile.id });
    const interpretation = await this.interpreter.interpretContext(context);
    const calibrationMetadata = { contextVersion: context.contextVersion, selectionPolicyVersion: context.selectionPolicyVersion, interpretationSchemaVersion: CAREER_READING_INTERPRETATION_SCHEMA_VERSION, validatorVersion: CAREER_READING_OUTPUT_VALIDATOR_VERSION, calibrationLevel: context.calibrationLevel, sourceEventIds: context.sourceEventIds, historicalEvidenceIds: context.historicalEvidence.map((item) => item.evidenceId), futureEvidenceIds: context.futureOccurrences.map((item) => item.evidenceId), compositeEvidenceIds: context.composites.map((item) => item.evidenceId), rulesets: context.rulesets, hasProvisionalEvidence: context.calculationBasis.hasProvisionalEvidence };
    return immutableCopy({ input: base.input, result: { ...base.result, reading: { ...base.result.reading, calibrationInterpretation: interpretation }, provenance: { ...base.result.provenance, calibrationMetadata } } });
  }
}
module.exports = { CalibratedCareerReadingGenerator };
