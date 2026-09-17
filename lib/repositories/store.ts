import { legacyRows, legacyDocuments, legacyContacts } from "./legacy";
import { google } from "../google";
import type { Entity } from "../types";
export const tables = [
  "Applications",
  "Companies",
  "Contacts",
  "Interactions",
  "Documents",
  "JobSources",
  "Profile",
  "Evidence",
  "Settings",
  "SyncLog",
] as const;
export type Table = (typeof tables)[number];
export type EventRow = [string, string, string, string, string];
// Append-only patches: concurrent writes never overwrite unrelated fields or physical rows.
// Sheets has no transaction/CAS; a true transactional outbox is a future Postgres migration.
export function fold<T extends Entity>(rows: string[][], seeds: T[] = []): T[] {
  const map = new Map<string, T>(seeds.map((v) => [v.id, v]));
  const events = new Set<string>();
  for (const row of rows) {
    if (row.length < 5 || events.has(row[0])) continue;
    events.add(row[0]);
    try {
      if (row[3] === "delete") map.delete(row[1]);
      else
        map.set(row[1], {
          ...map.get(row[1]),
          ...JSON.parse(row[4]),
          id: row[1],
        } as T);
    } catch {
      throw new Error(
        "Données illisibles : une ligne du journal doit être réparée.",
      );
    }
  }
  return [...map.values()];
}
export interface Repository<T extends Entity> {
  findAll(): Promise<T[]>;
  findById(id: string): Promise<T | undefined>;
  create(value: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}
export class SheetsRepository<T extends Entity> implements Repository<T> {
  constructor(
    private token: string,
    private table: Table,
    private sheet = process.env.GOOGLE_SPREADSHEET_ID,
  ) {
    if (!sheet)
      throw new Error(
        "Initialisez le Google Sheet puis configurez GOOGLE_SPREADSHEET_ID.",
      );
  }
  async findAll() {
    const r = await google<{ values?: string[][] }>(
      this.token,
      `sheets/v4/spreadsheets/${this.sheet}/values/${this.table}!A1:AZ`,
    );
    const { seeds, events } = legacyRows(this.table, r.values || []);
    if (this.table === "Documents" || this.table === "Contacts") {
      const apps = await new SheetsRepository<Entity>(
        this.token,
        "Applications",
        this.sheet,
      ).findAll();
      seeds.unshift(
        ...(this.table === "Documents"
          ? legacyDocuments(apps)
          : legacyContacts(apps)
        ).filter((d) => !seeds.some((s) => s.id === d.id)),
      );
    }
    return fold<T>(events, seeds as T[]);
  }
  async findById(id: string) {
    return (await this.findAll()).find((v) => v.id === id);
  }
  private async append(id: string, op: string, patch: Partial<T>) {
    const json = JSON.stringify(patch);
    if (json.length > 45000)
      throw new Error(
        "Ce dossier dépasse la taille autorisée. Réduisez le texte importé.",
      );
    const values = [
      [crypto.randomUUID(), id, new Date().toISOString(), op, json],
    ];
    await google(
      this.token,
      `sheets/v4/spreadsheets/${this.sheet}/values/${this.table}!A:E:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values }) },
    );
  }
  async create(value: T) {
    const old = await this.findById(value.id);
    if (old) return old;
    await this.append(value.id, "create", value);
    return value;
  }
  async update(id: string, patch: Partial<T>) {
    const old = await this.findById(id);
    if (!old) throw new Error("Dossier introuvable");
    const next = { ...patch, updatedAt: new Date().toISOString() };
    await this.append(id, "patch", next);
    return { ...old, ...next };
  }
  async remove(id: string) {
    await this.append(id, "delete", {});
  }
}
export const entity = (id = crypto.randomUUID()) => ({
  id,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
export async function initialize(token: string) {
  let spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  let folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!spreadsheetId) {
    const existing = await google<{ files: { id: string }[] }>(
      token,
      "drive/v3/files?q=" +
        encodeURIComponent(
          "trashed = false and name = 'Application CRM' and mimeType = 'application/vnd.google-apps.spreadsheet'",
        ),
    );
    spreadsheetId = existing.files[0]?.id;
    if (!spreadsheetId) {
      const s = await google<{ spreadsheetId: string }>(
        token,
        "sheets/v4/spreadsheets",
        {
          method: "POST",
          body: JSON.stringify({
            properties: { title: "Application CRM" },
            sheets: tables.map((title) => ({ properties: { title } })),
          }),
        },
      );
      spreadsheetId = s.spreadsheetId;
      await google(
        token,
        `sheets/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          method: "POST",
          body: JSON.stringify({
            valueInputOption: "RAW",
            data: tables.map((t) => ({
              range: t + "!A1:E1",
              values: [
                [
                  "eventId",
                  "entityId",
                  "timestamp",
                  "operation",
                  "payloadJSON",
                ],
              ],
            })),
          }),
        },
      );
    }
  }
  if (!folderId) {
    const q = encodeURIComponent(
      "trashed = false and name = 'Application CRM' and mimeType = 'application/vnd.google-apps.folder'",
    );
    const old = await google<{ files: { id: string }[] }>(
      token,
      "drive/v3/files?q=" + q,
    );
    folderId = old.files[0]?.id;
    if (!folderId) {
      const f = await google<{ id: string }>(token, "drive/v3/files", {
        method: "POST",
        body: JSON.stringify({
          name: "Application CRM",
          mimeType: "application/vnd.google-apps.folder",
        }),
      });
      folderId = f.id;
    }
    for (const name of ["CV", "Letters", "Job Descriptions", "Applications"]) {
      const children = await google<{ files: { id: string }[] }>(
        token,
        "drive/v3/files?q=" +
          encodeURIComponent(
            `trashed = false and '${folderId}' in parents and name = '${name}'`,
          ),
      );
      if (!children.files.length)
        await google(token, "drive/v3/files", {
          method: "POST",
          body: JSON.stringify({
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [folderId],
          }),
        });
    }
  }
  return { spreadsheetId, folderId };
}
