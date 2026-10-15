'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PostgresLifeEventRepository } = require('../../src/persistence/postgres');

function row(values) {
  return {
    id: values[0],
    user_id: values[1],
    birth_profile_id: values[2],
    category: values[3],
    event_type: values[4],
    event_date_precision: values[5],
    event_year: values[6],
    event_month: values[7],
    event_day: values[8],
    title: values[9],
    note: values[10],
    legacy_source_type: null,
    legacy_source_id: null,
    created_at: values[11],
    updated_at: values[12],
    deleted_at: null,
  };
}

function input({ category, eventType, precision, year, month = null, day = null }) {
  return {
    id: `event-${eventType.toLowerCase()}`,
    userId: 'user-a',
    birthProfileId: 'profile-a',
    category,
    eventType,
    eventDatePrecision: precision,
    eventYear: year,
    eventMonth: month,
    eventDay: day,
    title: null,
    note: null,
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
  };
}

test('Postgres Life Event repository maps approved categories and DAY/MONTH/YEAR columns without a fabricated day', async () => {
  const requests = [];
  const repository = new PostgresLifeEventRepository({
    db: {
      async query(sql, values) {
        requests.push({ sql, values });
        return { rows: [row(values)] };
      },
    },
  });
  const cases = [
    input({ category: 'PROPERTY', eventType: 'PROPERTY_PURCHASE', precision: 'DAY', year: 2020, month: 4, day: 5 }),
    input({ category: 'VEHICLE', eventType: 'VEHICLE_PURCHASE', precision: 'MONTH', year: 2021, month: 3 }),
    input({ category: 'RELATIONSHIPS_FAMILY', eventType: 'MARRIAGE', precision: 'YEAR', year: 2022 }),
    input({ category: 'RELATIONSHIPS_FAMILY', eventType: 'CHILD_BIRTH', precision: 'MONTH', year: 2023, month: 9 }),
  ];

  for (const value of cases) await repository.create(value);

  assert.equal(requests.length, 4);
  for (const request of requests) {
    assert.match(request.sql, /insert into app\.life_events/);
    assert.match(request.sql, /event_date_precision,event_year,event_month,event_day/);
  }
  assert.deepEqual(requests[0].values.slice(3, 9), ['PROPERTY', 'PROPERTY_PURCHASE', 'DAY', 2020, 4, 5]);
  assert.deepEqual(requests[1].values.slice(3, 9), ['VEHICLE', 'VEHICLE_PURCHASE', 'MONTH', 2021, 3, null]);
  assert.deepEqual(requests[2].values.slice(3, 9), ['RELATIONSHIPS_FAMILY', 'MARRIAGE', 'YEAR', 2022, null, null]);
  assert.deepEqual(requests[3].values.slice(3, 9), ['RELATIONSHIPS_FAMILY', 'CHILD_BIRTH', 'MONTH', 2023, 9, null]);
});

test('Postgres Life Event repository reports a safe RLS insert diagnostic before mapping the public error', async () => {
  const diagnostics = [];
  const repository = new PostgresLifeEventRepository({
    db: {
      async query() {
        const error = new Error('permission denied for relation life_events');
        error.code = '42501';
        error.schema = 'app';
        error.table = 'life_events';
        throw error;
      },
    },
  });
  await assert.rejects(
    () => repository.create({ ...input({ category: 'PROPERTY', eventType: 'PROPERTY_PURCHASE', precision: 'MONTH', year: 2026, month: 10 }), diagnosticLog: (entry) => diagnostics.push(entry) }),
    (error) => error.code === 'CREATE_LIFE_EVENT_FAILED',
  );
  assert.deepEqual(diagnostics, [{
    event: 'LIFE_EVENT_DB_INSERT',
    stage: 'INSERT',
    postgresErrorCode: '42501',
    constraint: null,
    errorClass: 'Error',
    safeMessageCategory: 'LIFE_EVENT_DB_RLS_FAILED',
  }]);
});

test('Postgres Life Event repository classifies returned-row mapping failures separately from database insert failures', async () => {
  const diagnostics = [];
  const repository = new PostgresLifeEventRepository({ db: { async query() { return { rows: [{}] }; } } });
  await assert.rejects(
    () => repository.create({ ...input({ category: 'PROPERTY', eventType: 'PROPERTY_PURCHASE', precision: 'MONTH', year: 2026, month: 10 }), diagnosticLog: (entry) => diagnostics.push(entry) }),
    (error) => error.code === 'INVALID_TIMESTAMP',
  );
  assert.deepEqual(diagnostics, [{
    event: 'LIFE_EVENT_DB_INSERT',
    stage: 'MAPPING',
    postgresErrorCode: null,
    constraint: null,
    errorClass: 'RangeError',
    safeMessageCategory: 'LIFE_EVENT_DB_MAPPING_FAILED',
  }]);
});
