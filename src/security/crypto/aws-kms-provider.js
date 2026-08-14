'use strict';

const crypto = require('node:crypto');
const { EncryptCommand, DecryptCommand, DescribeKeyCommand } = require('@aws-sdk/client-kms');
const { DEK_BYTES } = require('./aes-gcm');
const { fail } = require('./crypto-errors');

const WRAPPING_ALGORITHM = 'AWS_KMS_SYMMETRIC_DEFAULT';
const APPLICATION = 'kundlinsights';
const PURPOSE = 'user-dek-wrap-v1';

function nonEmpty(value) { return typeof value === 'string' && value.length > 0 && value.trim() === value; }
function arn(value) { return nonEmpty(value) && /^arn:aws(?:-[a-z]+)?:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]+$/i.test(value); }
function context(keyVersion) { return { application: APPLICATION, purpose: PURPOSE, envelopeVersion: keyVersion }; }
function buffer(value) { return Buffer.isBuffer(value) ? Buffer.from(value) : value instanceof Uint8Array ? Buffer.from(value) : null; }

class AwsKmsProvider {
  constructor({ client, kmsKeyArn, historicalKmsKeyArns = [], keyVersionGenerator = crypto.randomUUID } = {}) {
    if (!client || typeof client.send !== 'function' || !arn(kmsKeyArn) || typeof keyVersionGenerator !== 'function' || !Array.isArray(historicalKmsKeyArns) || !historicalKmsKeyArns.every(arn)) fail('INVALID_KMS_PROVIDER_CONFIGURATION');
    this.client = client;
    this.kmsKeyArn = kmsKeyArn;
    this.keyVersionGenerator = keyVersionGenerator;
    this.allowedKeyRefs = new Set([kmsKeyArn, ...historicalKmsKeyArns]);
  }
  getCurrentKeyVersion() { const value = this.keyVersionGenerator(); if (!nonEmpty(value)) fail('DEK_NOT_AVAILABLE'); return value; }
  getWrappingMetadata({ keyVersion }) { if (!nonEmpty(keyVersion)) fail('INVALID_KMS_METADATA'); return Object.freeze({ kmsKeyRef: this.kmsKeyArn, wrappingAlgorithm: WRAPPING_ALGORITHM }); }
  async wrapDek({ keyVersion, dek } = {}) {
    if (!nonEmpty(keyVersion) || !Buffer.isBuffer(dek) || dek.length !== DEK_BYTES) fail('DEK_WRAP_FAILED');
    try {
      const result = await this.client.send(new EncryptCommand({ KeyId: this.kmsKeyArn, Plaintext: Buffer.from(dek), EncryptionContext: context(keyVersion), EncryptionAlgorithm: 'SYMMETRIC_DEFAULT' }));
      const ciphertext = buffer(result && result.CiphertextBlob);
      if (!ciphertext || ciphertext.length === 0) fail('DEK_WRAP_FAILED');
      return ciphertext;
    } catch (error) { if (error && error.code === 'DEK_WRAP_FAILED') throw error; fail('DEK_WRAP_FAILED'); }
  }
  async unwrapDek({ keyVersion, kmsKeyRef, wrappingAlgorithm, wrappedDek } = {}) {
    if (!nonEmpty(keyVersion) || !arn(kmsKeyRef) || !this.allowedKeyRefs.has(kmsKeyRef) || wrappingAlgorithm !== WRAPPING_ALGORITHM || !Buffer.isBuffer(wrappedDek) || wrappedDek.length === 0) fail('DEK_UNWRAP_FAILED');
    try {
      const result = await this.client.send(new DecryptCommand({ KeyId: kmsKeyRef, CiphertextBlob: Buffer.from(wrappedDek), EncryptionContext: context(keyVersion), EncryptionAlgorithm: 'SYMMETRIC_DEFAULT' }));
      const dek = buffer(result && result.Plaintext);
      if (!dek || dek.length !== DEK_BYTES) fail('DEK_UNWRAP_FAILED');
      return dek;
    } catch (error) { if (error && error.code === 'DEK_UNWRAP_FAILED') throw error; fail('DEK_UNWRAP_FAILED'); }
  }
  async validateStartupKey() {
    try {
      const result = await this.client.send(new DescribeKeyCommand({ KeyId: this.kmsKeyArn })); const key = result && result.KeyMetadata;
      if (!key || key.KeyState !== 'Enabled' || key.KeyUsage !== 'ENCRYPT_DECRYPT' || (key.KeySpec && key.KeySpec !== 'SYMMETRIC_DEFAULT')) fail('KMS_STARTUP_VALIDATION_FAILED');
      return Object.freeze({ keyArn: key.Arn || this.kmsKeyArn, keyState: key.KeyState, keyUsage: key.KeyUsage, keySpec: key.KeySpec || 'SYMMETRIC_DEFAULT' });
    } catch (error) { if (error && error.code === 'KMS_STARTUP_VALIDATION_FAILED') throw error; fail('KMS_STARTUP_VALIDATION_FAILED'); }
  }
}

module.exports = { AwsKmsProvider, WRAPPING_ALGORITHM, kmsEncryptionContext: context };
