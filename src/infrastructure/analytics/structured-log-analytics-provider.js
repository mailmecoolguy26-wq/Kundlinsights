'use strict';

const CAREER_EVENT_NAMES = new Set([
  'career_timing_v2_shadow',
  'career_timing_consumer_shadow',
]);

function defaultWrite(line) { console.log(line); }

class StructuredLogAnalyticsProvider {
  constructor({ write = defaultWrite, clock = () => new Date().toISOString() } = {}) {
    if (typeof write !== 'function' || typeof clock !== 'function') throw new TypeError('Structured log analytics dependencies must be functions.');
    this.write = write;
    this.clock = clock;
    Object.freeze(this);
  }

  async track(eventName, properties) {
    if (!CAREER_EVENT_NAMES.has(eventName)) throw new RangeError('Unsupported structured analytics event.');
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new TypeError('Structured analytics properties must be an object.');
    for (const value of Object.values(properties)) {
      if (value !== null && (!['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value))) throw new TypeError('Structured analytics properties must be finite scalars.');
    }
    const event = Object.freeze({
      level: 'info',
      message: eventName,
      msg: eventName,
      category: 'aggregate_analytics',
      event: eventName,
      observedAt: this.clock(),
      ...properties,
      properties,
    });
    this.write(JSON.stringify(event));
  }
}

module.exports = { StructuredLogAnalyticsProvider, CAREER_EVENT_NAMES };
