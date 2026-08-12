'use strict';

const crypto = require('node:crypto');
const { fail, safeCrypto } = require('./crypto-errors');

const ALGORITHM = 'aes-256-gcm-v1';
const ENCRYPTION_VERSION = 1;
const DEK_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
function validKey(dek) { if (!Buffer.isBuffer(dek) || dek.length !== DEK_BYTES) fail('DEK_NOT_AVAILABLE'); return dek; }
function validNonce(nonce) { if (!Buffer.isBuffer(nonce) || nonce.length !== NONCE_BYTES) fail('INVALID_ENCRYPTION_PAYLOAD'); return nonce; }
function encrypt({ dek, plaintext, aad, randomBytes = crypto.randomBytes } = {}) { return safeCrypto(() => { validKey(dek); if (!Buffer.isBuffer(plaintext) || !Buffer.isBuffer(aad)) fail('INVALID_ENCRYPTION_PAYLOAD'); const nonce = randomBytes(NONCE_BYTES); validNonce(nonce); const cipher = crypto.createCipheriv('aes-256-gcm', dek, nonce, { authTagLength: AUTH_TAG_BYTES }); cipher.setAAD(aad); return { ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]), nonce }; }, 'ENCRYPTION_FAILED'); }
function decrypt({ dek, ciphertext, nonce, aad } = {}) { return safeCrypto(() => { validKey(dek); validNonce(nonce); if (!Buffer.isBuffer(ciphertext) || ciphertext.length < AUTH_TAG_BYTES || !Buffer.isBuffer(aad)) fail('INVALID_ENCRYPTION_PAYLOAD'); const body = ciphertext.subarray(0, -AUTH_TAG_BYTES); const tag = ciphertext.subarray(-AUTH_TAG_BYTES); const decipher = crypto.createDecipheriv('aes-256-gcm', dek, nonce, { authTagLength: AUTH_TAG_BYTES }); decipher.setAAD(aad); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(body), decipher.final()]); }, 'AUTHENTICATION_FAILED'); }

module.exports = { ALGORITHM, ENCRYPTION_VERSION, DEK_BYTES, NONCE_BYTES, AUTH_TAG_BYTES, encrypt, decrypt };
