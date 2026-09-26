'use strict';

function text(value) {
  return typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0;
}

function check(name, condition) {
  console.log(`${condition ? 'OK' : 'INVALID'}: ${name}`);
  return condition;
}

function validHttps(value) {
  if (!text(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validDatabase(value) {
  if (!text(value)) return false;
  try {
    const parsed = new URL(value);
    return (
      ['postgres:', 'postgresql:'].includes(parsed.protocol) &&
      !!parsed.hostname &&
      parsed.searchParams.get('sslmode') !== 'disable'
    );
  } catch {
    return false;
  }
}

function validArn(value) {
  return text(value) &&
    /^arn:aws(?:-[a-z]+)?:kms:[a-z0-9-]+:\d{12}:key\/[0-9a-f-]+$/i.test(value);
}

function validRegion(value) {
  return text(value) &&
    /^[a-z]{2}(?:-gov)?-[a-z]+-\d+$/.test(value);
}

function validOrigins(value) {
  if (!text(value)) return false;

  const items = value.split(',');
  if (!items.length || new Set(items).size !== items.length) return false;

  return items.every(origin => {
    try {
      const parsed = new URL(origin);
      return (
        parsed.protocol === 'https:' &&
        parsed.pathname === '/' &&
        !parsed.search &&
        !parsed.hash &&
        !parsed.username &&
        !parsed.password &&
        !origin.includes('*')
      );
    } catch {
      return false;
    }
  });
}

const env = process.env;

const results = [
  check('NODE_ENV', env.NODE_ENV === 'production'),
  check('HOST', text(env.HOST)),
  check('DATABASE_URL', validDatabase(env.DATABASE_URL)),
  check('SUPABASE_AUTH_ISSUER', validHttps(env.SUPABASE_AUTH_ISSUER)),
  check('SUPABASE_AUTH_JWKS_URL', validHttps(env.SUPABASE_AUTH_JWKS_URL)),
  check('SUPABASE_AUTH_AUDIENCE', text(env.SUPABASE_AUTH_AUDIENCE)),
  check(
    'SUPABASE_AUTH_ALLOWED_ALGORITHMS',
    text(env.SUPABASE_AUTH_ALLOWED_ALGORITHMS) &&
      env.SUPABASE_AUTH_ALLOWED_ALGORITHMS
        .split(',')
        .every(v =>
          ['ES256','ES384','ES512','RS256','RS384','RS512','PS256','PS384','PS512']
            .includes(v)
        )
  ),
  check('AWS_REGION', validRegion(env.AWS_REGION)),
  check('KUNDLINSIGHTS_KMS_KEY_ARN', validArn(env.KUNDLINSIGHTS_KMS_KEY_ARN)),
  check('GOOGLE_MAPS_API_KEY', text(env.GOOGLE_MAPS_API_KEY)),
  check('OPENAI_API_KEY', text(env.OPENAI_API_KEY)),
  check('OPENAI_CAREER_MODEL', text(env.OPENAI_CAREER_MODEL)),
  check('TIMEZONE_RUNTIME_MANIFEST_PATH', text(env.TIMEZONE_RUNTIME_MANIFEST_PATH)),
  check('TIMEZONE_RUNTIME_BINARY_PATH', text(env.TIMEZONE_RUNTIME_BINARY_PATH)),
  check('CORS_ALLOWED_ORIGINS', validOrigins(env.CORS_ALLOWED_ORIGINS)),
];

if (!results.every(Boolean)) {
  process.exitCode = 1;
} else {
  console.log('All required production environment variable formats look valid.');
}
