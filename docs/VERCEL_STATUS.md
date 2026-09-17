# Vercel status

Observed 2026-09-16 17:37 Europe/Paris.

Project `ubique` exists on team LECH and is linked to `leojacques-code/Ubique`.

The current production deployment was built from `main` at commit `a5e0565` (`chore: initialize Ubique application CRM`). Vercel reports READY, but its build log says no functions, static output, or services were produced. The public alias tested returns 404.

This is not a runtime bug in the V1 application: the deployed revision is still the initial main branch, not the reconciled application code.

For the Astra final pass:

1. checkpoint local work;
2. compare with `origin/build/v1-application-crm`;
3. preserve local modules that are more advanced;
4. integrate only missing deltas;
5. run one final validation;
6. push the reconciled revision intended for production;
7. confirm Vercel detects Next.js and produces actual routes/output;
8. run the remote smoke test.

Vercel currently reports Node 24.x while the GitHub CI branch has been validated using Node 22. Prefer aligning Vercel with the validated runtime unless Astra has already validated Node 24 locally.
