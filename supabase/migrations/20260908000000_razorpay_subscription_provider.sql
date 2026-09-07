-- Razorpay finalization writes normalized subscription lifecycle state.
alter table app.subscription_records drop constraint subscription_records_provider_check;
alter table app.subscription_records add constraint subscription_records_provider_check check (provider in ('APPLE', 'GOOGLE', 'RAZORPAY', 'WEB'));
