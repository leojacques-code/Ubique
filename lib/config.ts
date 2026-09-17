export const ownerEmail = () =>
  process.env.ALLOWED_GOOGLE_EMAIL || process.env.ALLOWED_EMAIL || "";
export const sessionConfigured = () =>
  !!(
    process.env.TOKEN_ENCRYPTION_KEY?.match(/^[a-f0-9]{64}$/i) ||
    (process.env.APP_SESSION_SECRET &&
      process.env.APP_SESSION_SECRET.length >= 32)
  );
export const oauthConfigured = () =>
  !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI &&
    process.env.APP_URL &&
    ownerEmail() &&
    sessionConfigured()
  );
export const backgroundConfigured = () =>
  !!(
    process.env.CRON_SECRET &&
    (process.env.GOOGLE_REFRESH_TOKEN_ENCRYPTED ||
      process.env.GOOGLE_REFRESH_TOKEN)
  );
