'use strict';

const { canonicalUtc, canonicalValue } = require('../../readings/reading-integrity');
const { freeze } = require('../../synthesis/evidence-node');

const REPOSITORY_CONTRACTS = freeze({
  UserRepository: freeze(['createUser', 'getUser', 'getUserByAuthSubject', 'updateUserStatus']),
  BirthProfileRepository: freeze(['createBirthProfile', 'getBirthProfile', 'listBirthProfilesForUser', 'updateBirthProfile', 'archiveBirthProfile']),
  ReadingRepository: freeze(['insertReadingRecord', 'getReadingRecord', 'getReadingRecordByIdempotencyKey', 'listReadingRecordsForUser', 'listReadingRecordsForBirthProfile', 'archiveReadingRecord']),
  EntitlementRepository: freeze(['createEntitlement', 'getEntitlement', 'listActiveEntitlementsForUser', 'consumeEntitlement']),
  PaymentRepository: freeze(['insertPaymentTransaction', 'getPaymentTransaction', 'findByProviderTransactionId']),
  PurchaseRepository: freeze(['findById', 'findByProviderTransaction', 'insert', 'listForUser']),
  SubscriptionRepository: freeze(['findByProviderOriginalTransaction', 'findUsableCandidatesForUser', 'upsertVerifiedState', 'listForUser']),
  ProfileEntitlementRepository: freeze(['findForProfile', 'findByPurchaseRecordId', 'create']),
  PaymentEventRepository: freeze(['findByProviderEventId', 'insertReceived', 'markProcessed', 'markFailed']),
});

function repositoryError(code) { const error = new RangeError(code); error.code = code; return error; }
function fail(code) { throw repositoryError(code); }
function requiredString(value, code) { if (typeof value !== 'string' || !value) fail(code); return value; }
function canonicalTime(value, code = 'INVALID_TIMESTAMP') { try { return canonicalUtc(value); } catch { fail(code); } }
function immutableCopy(value, code = 'INVALID_PERSISTENCE_VALUE') { try { return freeze(canonicalValue(value)); } catch { fail(code); } }
function compareCreatedAscending(left, right) { return Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id); }
function compareCreatedDescending(left, right) { return Date.parse(right.createdAt) - Date.parse(left.createdAt) || left.id.localeCompare(right.id); }

module.exports = { REPOSITORY_CONTRACTS, repositoryError, fail, requiredString, canonicalTime, immutableCopy, compareCreatedAscending, compareCreatedDescending };
