'use strict';
const test = require('node:test'); const assert = require('node:assert/strict');
const { compareCareerHistoricalRecurrence } = require('../../src/application/insights');
const interval = (start, end) => ({ start: `${start}T00:00:00.000Z`, end: `${end}T00:00:00.000Z` });
const observation = (start, end, structuralFeatures, planetSpecificFeatures = []) => ({ interval: interval(start, end), snapshots: [{ structuralFeatures, planetSpecificFeatures }] });
test('recurrence fails closed for first, later, overlapping, and same-transition observations', () => {
 const current={transitionId:'now',interval:interval('2020-06-01','2020-06-02'),structuralFeatures:['DASHA_AD_H10_OCCUPANT'],planetSpecificFeatures:['MERCURY']};
 const base={profileId:'a',current};
 assert.equal(compareCareerHistoricalRecurrence({...base,transitions:[]}).available,false);
 const same={id:'now',profileId:'a',observations:[observation('2020-01-01','2020-01-02',['DASHA_AD_H10_OCCUPANT'])]};
 const future={id:'future',profileId:'a',observations:[observation('2020-07-01','2020-07-02',['DASHA_AD_H10_OCCUPANT'])]};
 const overlap={id:'overlap',profileId:'a',observations:[observation('2020-05-31','2020-06-03',['DASHA_AD_H10_OCCUPANT'])]};
 assert.equal(compareCareerHistoricalRecurrence({...base,transitions:[same,future,overlap]}).available,false);
});
test('recurrence is profile-scoped and structurally normalizes different planets', () => {
 const current={transitionId:'now',interval:interval('2020-06-01','2020-06-02'),structuralFeatures:['DASHA_AD_H10_OCCUPANT','GOCHAR_JUPITER_SAME_SUBJECT'],planetSpecificFeatures:['MERCURY']};
 const prior={id:'prior',profileId:'a',observations:[observation('2020-01-01','2020-01-02',['DASHA_AD_H10_OCCUPANT','GOCHAR_JUPITER_SAME_SUBJECT'],['VENUS'])]};
 const foreign={id:'foreign',profileId:'b',observations:[observation('2020-01-01','2020-01-02',['DASHA_AD_H10_OCCUPANT'],['MERCURY'])]};
 const result=compareCareerHistoricalRecurrence({profileId:'a',current,transitions:[prior,foreign]});
 assert.equal(result.recurrencePresent,true); assert.deepEqual(result.structurallyMatchedTransitions,['prior']); assert.deepEqual(result.planetSpecificMatchedTransitions,[]); assert.deepEqual(result.matchedStructuralFeatures,['DASHA_AD_H10_OCCUPANT','GOCHAR_JUPITER_SAME_SUBJECT']);
});
