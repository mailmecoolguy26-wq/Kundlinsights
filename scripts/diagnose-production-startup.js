'use strict';

const { Pool } = require('pg');
const {
  KMSClient,
  DescribeKeyCommand,
} = require('@aws-sdk/client-kms');

const {
  loadProductionConfig,
} = require('../src/runtime/production-config');

async function main() {
  const config = loadProductionConfig(process.env);

  console.log('OK: PRODUCTION_CONFIG');

  const db = new Pool({
    connectionString: config.databaseUrl,
    max: 1,
    connectionTimeoutMillis: config.db.connectionTimeoutMillis,
    idleTimeoutMillis: config.db.idleTimeoutMillis,
    ssl: config.db.ssl,
    application_name: 'taraverse-production-diagnostic',
  });

  try {
    await db.query('select 1');
    console.log('OK: DATABASE_CONNECTIVITY');
  } catch (error) {
    console.error(
      'FAILED: DATABASE_CONNECTIVITY',
      error && (error.code || error.name)
        ? (error.code || error.name)
        : 'UNKNOWN_ERROR',
    );
  } finally {
    await db.end().catch(() => {});
  }

  const kms = new KMSClient({
    region: config.aws.region,
    maxAttempts: 3,
    retryMode: 'standard',
  });

  try {
    const result = await kms.send(
      new DescribeKeyCommand({
        KeyId: config.aws.kmsKeyArn,
      }),
    );

    const metadata = result && result.KeyMetadata;

    if (
      metadata &&
      metadata.KeyState === 'Enabled' &&
      metadata.KeyUsage === 'ENCRYPT_DECRYPT'
    ) {
      console.log('OK: AWS_KMS_CONNECTIVITY');
    } else {
      console.log('FAILED: AWS_KMS_KEY_STATE');
    }
  } catch (error) {
    console.error(
      'FAILED: AWS_KMS_CONNECTIVITY',
      error && (error.name || error.code)
        ? (error.name || error.code)
        : 'UNKNOWN_ERROR',
    );
  } finally {
    kms.destroy();
  }
}

main().catch((error) => {
  console.error(
    'DIAGNOSTIC_FAILED',
    error && (error.code || error.name)
      ? (error.code || error.name)
      : 'UNKNOWN_ERROR',
  );
  process.exitCode = 1;
});
