# SEC-P5 wrapped-DEK persistence

SEC-P5 adds a forward-only `app.user_key_envelopes` table for wrapped per-user DEKs. It stores only a wrapped DEK, KMS key reference, wrapping algorithm, version, lifecycle timestamps, and status. It never stores a raw DEK or a KMS master key.

One partial unique index permits exactly one `active` envelope per user. Rotation atomically retires that envelope and inserts a new active version; retired rows remain decryptable by their stored key version. The immutable trigger permits only the active-to-retired lifecycle change.

The injected `PostgresUserKeyEnvelopeStore` performs parameterized SQL only and creates no pool. `app_crypto` is a non-login, non-superuser, non-BYPASSRLS role with access solely to this table. It operates under the same transaction-local verified subject context as SEC-P3; `app_runtime` and direct clients have no envelope-table privileges.

`UserDekProvider` now awaits the injected store: ordinary writes use the active stored envelope and decrypts use the ciphertext’s stored key version. Provisioning and rotation are explicit operations; codecs never silently create an envelope. Cloud KMS implementation and raw-key persistence remain out of scope.
