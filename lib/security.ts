import { dateInTimeZone } from "./dates";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
function encryptionKey() {
  if (process.env.TOKEN_ENCRYPTION_KEY) {
    if (!/^[a-f0-9]{64}$/i.test(process.env.TOKEN_ENCRYPTION_KEY))
      throw new Error("Clé de session invalide");
    return Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex");
  }
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("APP_SESSION_SECRET doit contenir au moins 32 caractères.");
  return createHash("sha256").update(secret).digest();
}
export function encrypt(value: unknown) {
  const key = encryptionKey();
  if (key.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY : 64 caractères hexadécimaux requis");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function decrypt<T>(value: string): T {
  const key = encryptionKey(),
    b = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(b.subarray(28)),
      decipher.final(),
    ]).toString(),
  );
}
export function equal(a: string, b: string) {
  return (
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export { publicUrl as safeUrl } from "./public-url";
export function gmailTerm(value: string) {
  return '"' + value.replace(/["\\\r\n{}()]/g, " ").slice(0, 160) + '"';
}
export function businessDate(date: string, days = 6) {
  const d = new Date(dateInTimeZone(new Date(date)) + "T12:00:00Z");
  for (let i = 0; i < days;) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) i++;
  }
  return d.toISOString().slice(0, 10);
}
export function fingerprint(a: {
  company: string;
  jobTitle: string;
  location: string;
  contractType: string;
  reference: string;
  startDate: string;
}) {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  return a.reference
    ? clean(a.company) + "|ref|" + clean(a.reference)
    : [a.company, a.jobTitle, a.location, a.contractType, a.startDate]
        .map(clean)
        .join("|");
}
