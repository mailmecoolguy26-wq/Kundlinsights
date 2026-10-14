'use strict';
const { repositoryError } = require('../../persistence/contracts');
const { CareerReadingOutputValidator, createInterpretationInput } = require('./career-reading-output-validator');
function fail(code) { throw repositoryError(code); }
function safeStackFrames(error) {
  if (!error || typeof error.stack !== 'string') return [];
  return error.stack.split('\n').slice(1, 4).map((frame) => frame.trim().replace(/:\d+:\d+(?=\)?$)/, '')).filter(Boolean);
}
function step(log, name, status, error = null) {
  if (typeof log !== 'function') return;
  log({ event: 'CAREER_READING_INTERPRETER_STEP', step: name, status, ...(error ? { errorClass: typeof error.name === 'string' ? error.name : 'Error', errorMessage: typeof error.message === 'string' ? error.message.slice(0, 160) : 'UNKNOWN_ERROR', stackFrames: safeStackFrames(error) } : {}) });
}
class CareerReadingInterpreter {
  constructor({ careerReadingContextBuilder, generator, outputValidator } = {}) { if (!careerReadingContextBuilder || typeof careerReadingContextBuilder.build !== 'function' || !generator || typeof generator.generate !== 'function') fail('INVALID_CAREER_READING_INTERPRETER'); this.contextBuilder = careerReadingContextBuilder; this.generator = generator; this.validator = outputValidator || new CareerReadingOutputValidator(); if (typeof this.validator.validate !== 'function') fail('INVALID_CAREER_READING_INTERPRETER'); }
  async interpret({ principal, birthProfileId } = {}) { return this.interpretContext(await this.contextBuilder.build({ principal, birthProfileId })); }
  async interpretContext(context, { diagnosticLog = null } = {}) {
    let interpretationInput;
    try { step(diagnosticLog, 'VALIDATE_INPUT', 'STARTED'); interpretationInput = createInterpretationInput(context); step(diagnosticLog, 'VALIDATE_INPUT', 'SUCCEEDED'); } catch (error) { step(diagnosticLog, 'VALIDATE_INPUT', 'FAILED', error); throw error; }
    let candidate;
    try { candidate = await this.generator.generate({ interpretationInput, diagnosticLog }); if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_CALCULATION', state: 'INTERPRETATION_SUCCEEDED' }); } catch (error) { step(diagnosticLog, 'BUILD_FINAL_READING', 'FAILED', error); if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_CALCULATION', state: 'INTERPRETATION_FAILED', safeErrorCode: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR', errorClass: typeof error.name === 'string' ? error.name : 'Error' }); if (error && error.code === 'READING_GENERATION_FAILED') throw error; fail('READING_GENERATION_FAILED'); }
    try { step(diagnosticLog, 'BUILD_FINAL_READING', 'STARTED'); const output = this.validator.validate({ context, candidate }); step(diagnosticLog, 'BUILD_FINAL_READING', 'SUCCEEDED'); if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_CALCULATION', state: 'OUTPUT_VALIDATED' }); return output; } catch (error) { step(diagnosticLog, 'BUILD_FINAL_READING', 'FAILED', error); if (typeof diagnosticLog === 'function') diagnosticLog({ event: 'CAREER_READING_CALCULATION', state: 'OUTPUT_INVALID', safeErrorCode: typeof error.code === 'string' ? error.code : 'UNKNOWN_ERROR', errorClass: typeof error.name === 'string' ? error.name : 'Error' }); if (error && error.code === 'READING_GENERATION_INVALID_OUTPUT') throw error; fail('READING_GENERATION_INVALID_OUTPUT'); }
  }
}
module.exports = { CareerReadingInterpreter };
