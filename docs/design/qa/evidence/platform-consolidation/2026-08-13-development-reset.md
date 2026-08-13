# Development deployment reset — 2026-08-13

This record covers the deployment cutover and the `DATA-001` requirement. All Convex
commands below targeted the named development deployment only:

- Deployment: `colorful-viper-224` (`dev/nderim-krasniqi`)
- Dashboard: `dashboard.convex.dev/t/nderim-krasniqi/huddle/colorful-viper-224`
- Runtime URL: `https://colorful-viper-224.convex.cloud`
- Production targeting: none; no `--prod` or production deployment reference
  was used.

## CLI record

1. `developmentReset:audit` before the reset returned:

   ```json
   {"games":0,"memberships":0,"rooms":0,"tvSessions":0}
   ```

2. The two reset gates were enabled briefly on `colorful-viper-224`:
   `HUDDLE_DEPLOYMENT_KIND=development` and
   `HUDDLE_ALLOW_DEVELOPMENT_RESET=true`.

3. `developmentReset:reset` was invoked with the exact confirmation literal
   `RESET_DEVELOPMENT_ROOMS` and returned:

   ```json
   {"games":0,"memberships":0,"rooms":0,"tvSessions":0}
   ```

4. Both gates were unset. `convex env list --names-only` reported no
   environment variables on the development deployment.

5. A post-reset `developmentReset:audit` returned zero for all four counts.
   A follow-up reset attempt was rejected with
   `developmentResetDisabled`, confirming the guard is closed.

6. `convex dev --once --typecheck enable` completed successfully against the
   same development deployment after the reset.
