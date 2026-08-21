'use strict';
const { repositoryError } = require('../../persistence/contracts');
const { CareerReadingOutputValidator, createInterpretationInput } = require('./career-reading-output-validator');
function fail(code) { throw repositoryError(code); }
class CareerReadingInterpreter {
  constructor({ careerReadingContextBuilder, generator, outputValidator } = {}) { if (!careerReadingContextBuilder || typeof careerReadingContextBuilder.build !== 'function' || !generator || typeof generator.generate !== 'function') fail('INVALID_CAREER_READING_INTERPRETER'); this.contextBuilder = careerReadingContextBuilder; this.generator = generator; this.validator = outputValidator || new CareerReadingOutputValidator(); if (typeof this.validator.validate !== 'function') fail('INVALID_CAREER_READING_INTERPRETER'); }
  async interpret({ principal, birthProfileId } = {}) { const context = await this.contextBuilder.build({ principal, birthProfileId }); const interpretationInput = createInterpretationInput(context); let candidate; try { candidate = await this.generator.generate({ interpretationInput }); } catch { fail('READING_GENERATION_INVALID_OUTPUT'); } try { return this.validator.validate({ context, candidate }); } catch (error) { if (error && error.code === 'READING_GENERATION_INVALID_OUTPUT') throw error; fail('READING_GENERATION_INVALID_OUTPUT'); } }
}
module.exports = { CareerReadingInterpreter };
