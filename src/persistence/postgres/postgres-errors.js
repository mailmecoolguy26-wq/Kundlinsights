'use strict';

const { repositoryError } = require('../contracts');

function persistenceError(code) { return repositoryError(code); }

function mapPostgresError(error, fallback = 'PERSISTENCE_OPERATION_FAILED') {
  if (!error || typeof error !== 'object') return persistenceError(fallback);
  if (error.code === '23505') {
    if (error.constraint === 'users_pkey') return persistenceError('DUPLICATE_USER_ID');
    if (error.constraint === 'users_auth_subject_key') return persistenceError('DUPLICATE_AUTH_SUBJECT');
    if (error.constraint === 'birth_profiles_pkey') return persistenceError('DUPLICATE_BIRTH_PROFILE_ID');
    if (error.constraint === 'payment_transactions_pkey') return persistenceError('DUPLICATE_PAYMENT_TRANSACTION_ID');
    if (error.constraint === 'payment_transactions_provider_provider_transaction_id_key') return persistenceError('DUPLICATE_PROVIDER_TRANSACTION');
    if (error.constraint === 'purchase_records_pkey') return persistenceError('DUPLICATE_PURCHASE_ID');
    if (error.constraint === 'purchase_records_provider_environment_provider_transaction_id_key') return persistenceError('DUPLICATE_PURCHASE_TRANSACTION');
    if (error.constraint === 'subscription_records_pkey') return persistenceError('DUPLICATE_SUBSCRIPTION_ID');
    if (error.constraint === 'subscription_records_provider_environment_original_transaction_id_key') return persistenceError('DUPLICATE_SUBSCRIPTION_IDENTITY');
    if (error.constraint === 'payment_events_pkey') return persistenceError('DUPLICATE_PAYMENT_EVENT_ID');
    if (error.constraint === 'payment_events_provider_environment_provider_event_id_key') return persistenceError('DUPLICATE_PROVIDER_EVENT');
    if (error.constraint === 'reading_records_pkey') return persistenceError('DUPLICATE_READING_ID');
    if (error.constraint === 'reading_records_user_idempotency_key_idx') return persistenceError('DUPLICATE_READING_IDEMPOTENCY_KEY');
    if (error.constraint === 'entitlements_pkey') return persistenceError('DUPLICATE_ENTITLEMENT_ID');
    return persistenceError('DUPLICATE_PERSISTENCE_RECORD');
  }
  if (error.code === '23503') return persistenceError('PERSISTENCE_FOREIGN_KEY_VIOLATION');
  if (error.code === '23514') return persistenceError('PERSISTENCE_CONSTRAINT_VIOLATION');
  return persistenceError(fallback);
}

module.exports = { persistenceError, mapPostgresError };
