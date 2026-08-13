-- SEC-P3.1: permit bootstrap visibility only for the trusted transaction-local subject.

drop policy app_runtime_select_own_user on app.users;

create policy app_runtime_select_own_user on app.users
  for select to app_runtime
  using (auth_subject = security.current_auth_subject());
