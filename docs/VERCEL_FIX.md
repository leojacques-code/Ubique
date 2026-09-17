# Vercel fix before final Ubique deployment

Observed on 2026-09-16 after the project was created.

## What is already proven

The preview build of `build/v1-application-crm` successfully:

- installed dependencies;
- ran `next build`;
- compiled Next.js;
- passed Next.js type validation;
- generated all 19 pages;
- produced the expected App Router routes and API routes.

It then failed only at Vercel's final artifact check with:

```text
Error: No Output Directory named "public" found after the Build completed.
Configure the Output Directory in your Project Settings.
```

So do **not** debug the Next.js application for this error. The Vercel project has a stale/custom Output Directory setting (`public`).

## Fast fix

From a local workspace already authenticated with Vercel, link to the existing `ubique` project if necessary, then reset the project build settings to framework defaults:

```bash
vercel link
vercel project update ubique --framework nextjs
vercel project update ubique --auto-detect output-directory
vercel project update ubique --auto-detect build-command
vercel project update ubique --auto-detect install-command
```

Equivalent dashboard action: set **Framework Preset = Next.js** and clear/reset the custom **Output Directory** so it returns to automatic detection.

Then redeploy the reconciled revision.

## Node runtime

Vercel currently reports Node 24.x and warns because `package.json` declares `node >=20`. The GitHub CI has been validated on Node 22. For maximum parity, pin/use Node 22 during the final reconciliation unless the final Astra workspace is explicitly validated on Node 24.

This runtime warning is not the cause of the failed preview; the `public` output-directory setting is.

## Final verification

After the Vercel setting is corrected and the reconciled code is deployed:

```bash
npm run smoke -- https://<final-domain>
```

Then test one real end-to-end application flow. Do not merge or overwrite Astra's more advanced local modules merely to solve this Vercel configuration issue.
