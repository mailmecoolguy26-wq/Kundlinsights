'use strict';

const { calculateGocharSnapshot } = require('../gochar');
const { BODIES } = require('../gochar/reference-data');
const {
  DEFAULT_COARSE_SCAN_STEP_MS,
  DEFAULT_REFINEMENT_TOLERANCE_MS,
  DEFAULT_MAX_REFINEMENT_ITERATIONS,
  MAX_COARSE_SCAN_STEP_MS,
  EVENT_TYPES,
} = require('./reference-data');
const { order, deduplicate } = require('./event-ordering');
const { refineBooleanTransition, refineCategoricalTransition } = require('./event-refinement');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function iso(milliseconds) {
  return new Date(milliseconds).toISOString();
}

function validateLayer1Body(name, body) {
  if (!body || typeof body !== 'object'
    || typeof body.siderealLongitudeDegrees !== 'number' || !Number.isFinite(body.siderealLongitudeDegrees)
    || !['direct', 'retrograde', 'stationary'].includes(body.motion)
    || typeof body.longitudeSpeedDegreesPerDay !== 'number' || !Number.isFinite(body.longitudeSpeedDegreesPerDay)) {
    throw new TypeError(`Layer 1 provider body ${name} is invalid.`);
  }
}

function layer1(engine, milliseconds, observer, bodies) {
  const instant = new Date(milliseconds);
  const result = engine.calculate({
    date: instant.toISOString().slice(0, 10),
    time: instant.toISOString().slice(11, 23),
    timezone: 'UTC',
    latitude: observer.latitude,
    longitude: observer.longitude,
    bodies,
  });
  if (!result || !result.bodies || typeof result.bodies !== 'object') {
    throw new TypeError('Layer 1 provider result is invalid.');
  }
  for (const name of bodies) validateLayer1Body(name, result.bodies[name]);
  return result;
}

function validateOptions(options) {
  const coarseScanStepMilliseconds = options.coarseScanStepMilliseconds ?? DEFAULT_COARSE_SCAN_STEP_MS;
  const refinementToleranceMilliseconds = options.refinementToleranceMilliseconds ?? DEFAULT_REFINEMENT_TOLERANCE_MS;
  const maximumRefinementIterations = options.maximumRefinementIterations ?? DEFAULT_MAX_REFINEMENT_ITERATIONS;
  if (!Number.isFinite(coarseScanStepMilliseconds) || coarseScanStepMilliseconds <= 0 || coarseScanStepMilliseconds > MAX_COARSE_SCAN_STEP_MS) {
    throw new RangeError('coarseScanStepMilliseconds must be positive and at most twenty-four hours.');
  }
  if (!Number.isFinite(refinementToleranceMilliseconds) || refinementToleranceMilliseconds <= 0) {
    throw new RangeError('refinementToleranceMilliseconds must be a positive finite number.');
  }
  if (!Number.isInteger(maximumRefinementIterations) || maximumRefinementIterations <= 0) {
    throw new RangeError('maximumRefinementIterations must be a positive integer.');
  }
  return { coarseScanStepMilliseconds, refinementToleranceMilliseconds, maximumRefinementIterations };
}

function associationMap(transitBody) {
  return new Map(transitBody.sameRashiNatalBodies.map((association) => [association.natalBody, association]));
}

function drishtiMap(transitBody) {
  const edges = [];
  for (const aspect of transitBody.aspectsNatalBodies) {
    if (aspect.targetNatalBodies.length === 0) {
      edges.push({ ...aspect, natalBody: null, natalRashi: null });
    } else {
      for (const target of aspect.targetNatalBodies) edges.push({ ...aspect, natalBody: target.natalBody, natalRashi: target.natalRashi });
    }
  }
  return new Map(edges.map((edge) => [`${edge.aspectNumber}:${edge.targetNatalRashiIndex}:${edge.natalBody || ''}`, edge]));
}

function selectedBodies(bodies) {
  if (bodies === undefined) return BODIES;
  if (!Array.isArray(bodies) || bodies.length === 0) throw new RangeError('bodies must be a non-empty array of supported transit bodies.');
  for (const body of bodies) if (!BODIES.includes(body)) throw new RangeError(`Unsupported transit body: ${body}`);
  return BODIES.filter((body) => bodies.includes(body));
}

function scanTransitEvents({ startInstant, endInstant, natalBodies, natalHouses, astronomicalEngine, observer, eventTypes, bodies, options = {} } = {}) {
  const start = Date.parse(startInstant);
  const end = Date.parse(endInstant);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !String(startInstant).endsWith('Z') || !String(endInstant).endsWith('Z') || start >= end) {
    throw new RangeError('startInstant and endInstant must be valid UTC instants with start before end.');
  }
  if (!astronomicalEngine || typeof astronomicalEngine.calculate !== 'function' || !observer) {
    throw new TypeError('astronomicalEngine and observer are required.');
  }
  const configuration = validateOptions(options);
  const types = eventTypes || [...EVENT_TYPES];
  for (const type of types) if (!EVENT_TYPES.has(type)) throw new RangeError(`Unsupported event type: ${type}`);
  const selected = selectedBodies(bodies);

  const at = (milliseconds) => {
    const layer1Result = layer1(astronomicalEngine, milliseconds, observer, selected);
    return {
      layer1Result,
      snapshot: calculateGocharSnapshot({
        snapshotInstant: iso(milliseconds),
        natalBodies,
        natalHouses,
        transitBodies: layer1Result.bodies, bodies: selected,
      }),
    };
  };
  const samples = [];
  for (let time = start; time < end; time += configuration.coarseScanStepMilliseconds) samples.push([time, at(time)]);
  samples.push([end, at(end)]);

  const events = [];
  const emit = (eventType, body, milliseconds, payload) => {
    if (types.includes(eventType)) events.push({ eventType, body, instant: iso(milliseconds), ...payload });
  };
  const refine = (lowInstant, highInstant, lowState, stateAtInstant) => refineCategoricalTransition({
    lowInstant,
    highInstant,
    evaluateStateAtInstant: (milliseconds) => stateAtInstant(at(milliseconds)),
    lowState,
    refinementToleranceMilliseconds: configuration.refinementToleranceMilliseconds,
    maximumRefinementIterations: configuration.maximumRefinementIterations,
  });
  const refineBoolean = (lowInstant, highInstant, wasActiveAtLow, isActiveAtInstant) => refineBooleanTransition({
    lowInstant,
    highInstant,
    evaluateStateAtInstant: (milliseconds) => isActiveAtInstant(at(milliseconds)),
    wasActiveAtLow,
    refinementToleranceMilliseconds: configuration.refinementToleranceMilliseconds,
    maximumRefinementIterations: configuration.maximumRefinementIterations,
  });
  const ingressBracket = (transition, name, priorRashiIndex) => {
    const gridHigh = start + Math.ceil((transition - start) / DEFAULT_COARSE_SCAN_STEP_MS) * DEFAULT_COARSE_SCAN_STEP_MS;
    for (const candidate of [gridHigh, gridHigh - DEFAULT_COARSE_SCAN_STEP_MS, gridHigh + DEFAULT_COARSE_SCAN_STEP_MS]) {
      const highInstant = Math.min(candidate, end);
      const lowInstant = candidate > end
        ? start + Math.floor((end - start) / DEFAULT_COARSE_SCAN_STEP_MS) * DEFAULT_COARSE_SCAN_STEP_MS
        : highInstant - DEFAULT_COARSE_SCAN_STEP_MS;
      if (lowInstant < start || highInstant <= lowInstant) continue;
      const canonicalBefore = at(lowInstant).snapshot.transitBodies[name];
      const canonicalAfter = at(highInstant).snapshot.transitBodies[name];
      if (canonicalBefore.transitRashi.rashiIndex === priorRashiIndex
        && canonicalAfter.transitRashi.rashiIndex !== priorRashiIndex) {
        return { lowInstant, highInstant, canonicalBefore, canonicalAfter };
      }
    }
    throw new RangeError('Cannot locate the canonical ingress refinement bracket.');
  };

  for (let index = 1; index < samples.length; index += 1) {
    const [lowInstant, old] = samples[index - 1];
    const [highInstant, next] = samples[index];
    for (const name of selected) {
      const before = old.snapshot.transitBodies[name];
      const after = next.snapshot.transitBodies[name];
      if (types.includes('rashiIngress') && before.transitRashi.rashiIndex !== after.transitRashi.rashiIndex) {
        const coarseTransition = refine(lowInstant, highInstant, before.transitRashi.rashiIndex, (result) => result.snapshot.transitBodies[name].transitRashi.rashiIndex);
        const { lowInstant: canonicalLowInstant, highInstant: canonicalHighInstant, canonicalBefore, canonicalAfter } = ingressBracket(coarseTransition, name, before.transitRashi.rashiIndex);
        const transition = refine(canonicalLowInstant, canonicalHighInstant, canonicalBefore.transitRashi.rashiIndex, (result) => result.snapshot.transitBodies[name].transitRashi.rashiIndex);
        const refined = at(transition).snapshot.transitBodies[name];
        emit('rashiIngress', name, transition, {
          fromRashi: canonicalBefore.transitRashi,
          toRashi: canonicalAfter.transitRashi,
          direction: refined.motion === 'retrograde' ? 'retrograde' : 'direct',
          canonicalSiderealLongitudeDegrees: refined.transitCanonicalSiderealLongitudeDegrees,
          providerMotion: refined.motion,
          provenance: 'layer2-rashi-transition',
        });
      }
      if (types.includes('sadeSatiPhaseChange') && name === 'Saturn' && before.sadeSati.phase !== after.sadeSati.phase) {
        const transition = refine(lowInstant, highInstant, before.sadeSati.phase, (result) => result.snapshot.transitBodies.Saturn.sadeSati.phase);
        const refined = at(transition).snapshot;
        const saturn = refined.transitBodies.Saturn;
        emit('sadeSatiPhaseChange', name, transition, {
          fromPhase: before.sadeSati.phase,
          toPhase: after.sadeSati.phase,
          saturnRashi: saturn.transitRashi,
          natalMoonRashi: refined.natalContext.natalMoonRashi,
          moonRelativeHouse: saturn.houseFromNatalMoon,
          providerMotion: saturn.motion,
          provenance: 'layer9-sade-sati-transition',
        });
      }
      if (types.includes('sameRashiAssociationStart') || types.includes('sameRashiAssociationEnd')) {
        const beforeAssociations = associationMap(before);
        const afterAssociations = associationMap(after);
        for (const natalBody of new Set([...beforeAssociations.keys(), ...afterAssociations.keys()])) {
          const wasActive = beforeAssociations.has(natalBody);
          if (wasActive === afterAssociations.has(natalBody)) continue;
          const transition = refineBoolean(lowInstant, highInstant, wasActive, (result) => associationMap(result.snapshot.transitBodies[name]).has(natalBody));
          const refined = at(transition).snapshot.transitBodies[name];
          const association = associationMap(refined).get(natalBody) || beforeAssociations.get(natalBody) || afterAssociations.get(natalBody);
          emit(wasActive ? 'sameRashiAssociationEnd' : 'sameRashiAssociationStart', name, transition, {
            transitBody: name,
            natalBody,
            transition: wasActive ? 'end' : 'start',
            transitRashi: refined.transitRashi,
            natalRashi: association.natalRashi,
            angularSeparationDegrees: association.minimumCircularLongitudeSeparationDegrees,
            providerMotion: refined.motion,
            provenance: 'layer9-same-rashi-transition',
          });
        }
      }
      if (types.includes('transitDrishtiStart') || types.includes('transitDrishtiEnd')) {
        const beforeAspects = drishtiMap(before);
        const afterAspects = drishtiMap(after);
        for (const key of new Set([...beforeAspects.keys(), ...afterAspects.keys()])) {
          const wasActive = beforeAspects.has(key);
          if (wasActive === afterAspects.has(key)) continue;
          const transition = refineBoolean(lowInstant, highInstant, wasActive, (result) => drishtiMap(result.snapshot.transitBodies[name]).has(key));
          const refined = at(transition).snapshot.transitBodies[name];
          const aspect = drishtiMap(refined).get(key) || beforeAspects.get(key) || afterAspects.get(key);
          emit(wasActive ? 'transitDrishtiEnd' : 'transitDrishtiStart', name, transition, {
            transitBody: name,
            natalBody: aspect.natalBody,
            transition: wasActive ? 'end' : 'start',
            casterRashi: refined.transitRashi,
            targetRashi: aspect.natalRashi || { rashiIndex: aspect.targetNatalRashiIndex },
            targetHouseNumber: aspect.targetNatalHouseNumber,
            drishtiOffset: aspect.rashiOffset,
            aspectOrdinal: aspect.aspectNumber,
            natalTargetRashi: aspect.targetNatalRashiIndex,
            natalTargetHouseNumber: aspect.targetNatalHouseNumber,
            providerMotion: refined.motion,
            provenance: 'layer9-layer6-drishti-transition',
          });
        }
      }
    }
  }

  if (types.includes('retrogradeStation') || types.includes('directStation')) for (const name of selected) {
    let priorDirectionalMotion = null;
    let stationaryWindowEntry = null;
    for (let index = 1; index < samples.length; index += 1) {
      const [lowInstant, old] = samples[index - 1];
      const [highInstant, next] = samples[index];
      const previousMotion = old.snapshot.transitBodies[name].motion;
      const nextMotion = next.snapshot.transitBodies[name].motion;
      if (previousMotion === nextMotion) continue;

      const transition = refine(lowInstant, highInstant, previousMotion, (result) => result.snapshot.transitBodies[name].motion);
      const transitionResult = at(transition);
      const transitionBody = transitionResult.layer1Result.bodies[name];
      const transitionMotion = transitionResult.snapshot.transitBodies[name].motion;

      if ((previousMotion === 'direct' || previousMotion === 'retrograde') && transitionMotion === 'stationary') {
        priorDirectionalMotion = previousMotion;
        stationaryWindowEntry = transition;
        continue;
      }
      if (previousMotion === 'stationary' && (transitionMotion === 'direct' || transitionMotion === 'retrograde')) {
        if (priorDirectionalMotion && transitionMotion !== priorDirectionalMotion) {
          const entryResult = at(stationaryWindowEntry);
          const entryBody = entryResult.layer1Result.bodies[name];
          emit(transitionMotion === 'retrograde' ? 'retrogradeStation' : 'directStation', name, stationaryWindowEntry, {
            fromMotion: priorDirectionalMotion,
            toMotion: transitionMotion,
            stationWindowEntryInstant: iso(stationaryWindowEntry),
            directionConfirmationInstant: iso(transition),
            providerMotionAtInstant: entryResult.snapshot.transitBodies[name].motion,
            longitudeSpeedDegreesPerDay: entryBody.longitudeSpeedDegreesPerDay,
          });
        }
        priorDirectionalMotion = transitionMotion;
        stationaryWindowEntry = null;
        continue;
      }
      if ((previousMotion === 'direct' || previousMotion === 'retrograde')
        && (transitionMotion === 'direct' || transitionMotion === 'retrograde')
        && transitionMotion !== previousMotion) {
        emit(transitionMotion === 'retrograde' ? 'retrogradeStation' : 'directStation', name, transition, {
          fromMotion: previousMotion,
          toMotion: transitionMotion,
          stationWindowEntryInstant: null,
          directionConfirmationInstant: iso(transition),
          providerMotionAtInstant: transitionBody.motion,
          longitudeSpeedDegreesPerDay: transitionBody.longitudeSpeedDegreesPerDay,
        });
        priorDirectionalMotion = transitionMotion;
        stationaryWindowEntry = null;
      }
    }
  }

  const firstLayer1Result = samples[0][1].layer1Result;
  const provenance = {
    providerIndependent: false,
    astronomicalCalculation: 'delegated-to-layer-1',
    ayanamshaCalculation: 'delegated-to-layer-1',
    gocharCalculation: 'delegated-to-layer-9',
    eventScanning: 'layer10-transition-refinement-v1',
    coarseScanStepMilliseconds: configuration.coarseScanStepMilliseconds,
    refinementToleranceMilliseconds: configuration.refinementToleranceMilliseconds,
    maximumRefinementIterations: configuration.maximumRefinementIterations,
    eventTimeSemantics: 'refined-first-instant-new-state-active',
    eventFamilies: {
      rashiIngress: 'layer2-rashi-transition',
      sadeSatiPhaseChange: 'layer9-sade-sati-transition',
      sameRashiAssociation: 'layer9-same-rashi-transition',
      transitDrishti: 'layer9-layer6-drishti-transition',
    },
    calculationStatus: firstLayer1Result.calculationStatus || 'UNKNOWN',
    provider: firstLayer1Result.provider || null,
  };
  return freeze({
    startInstant,
    endInstant,
    events: deduplicate(events).sort(order),
    configuration: { ...configuration },
    provenance,
  });
}

module.exports = { scanTransitEvents };
