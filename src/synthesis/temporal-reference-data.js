'use strict';

const TEMPORAL_RULESET_ID = 'parashari-temporal-activation-evidence-v1';
const TEMPORAL_RELATION_TYPES = Object.freeze(['TEMPORALLY_ACTIVATES', 'TEMPORAL_CO_ACTIVATION']);
const SUPPORTED_TRANSIT_EVENT_TYPES = Object.freeze(['retrogradeStation', 'directStation', 'rashiIngress', 'sadeSatiPhaseChange', 'sameRashiAssociationStart', 'sameRashiAssociationEnd', 'transitDrishtiStart', 'transitDrishtiEnd']);

module.exports = { TEMPORAL_RULESET_ID, TEMPORAL_RELATION_TYPES, SUPPORTED_TRANSIT_EVENT_TYPES };
