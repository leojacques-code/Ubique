import { accessToken, requireSession, AuthError } from "@/lib/auth";
import { SheetsRepository } from "@/lib/repositories/store";
import {
  defaultProfile,
  defaultSettings,
  type Application,
  type Contact,
  type Document,
  type Interaction,
  type Profile,
  type Settings,
  type SyncLog,
} from "@/lib/types";
export async function GET() {
  try {
    const s = await requireSession();
    const token = await accessToken();
    if (!process.env.GOOGLE_SPREADSHEET_ID)
      return Response.json({
        applications: [],
        contacts: [],
        documents: [],
        interactions: [],
        profile: defaultProfile,
        settings: defaultSettings,
        logs: [],
        email: s.email,
        demo: false,
        connections: {
          google: true,
          sheets: false,
          openai: !!process.env.OPENAI_API_KEY,
          search: !!process.env.TAVILY_API_KEY,
          cron: !!process.env.GOOGLE_REFRESH_TOKEN_ENCRYPTED,
        },
      });
    const [
      applications,
      contacts,
      documents,
      interactions,
      profiles,
      settings,
      logs,
    ] = await Promise.all([
      new SheetsRepository<Application>(token, "Applications").findAll(),
      new SheetsRepository<Contact>(token, "Contacts").findAll(),
      new SheetsRepository<Document>(token, "Documents").findAll(),
      new SheetsRepository<Interaction>(token, "Interactions").findAll(),
      new SheetsRepository<Profile>(token, "Profile").findAll(),
      new SheetsRepository<Settings>(token, "Settings").findAll(),
      new SheetsRepository<SyncLog>(token, "SyncLog").findAll(),
    ]);
    return Response.json({
      applications,
      contacts,
      documents,
      interactions,
      profile: profiles[0] || defaultProfile,
      settings: settings[0] || defaultSettings,
      logs: logs.slice(-20).reverse(),
      email: s.email,
      demo: false,
      connections: {
        google: true,
        sheets: true,
        openai: !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_MODEL,
        search: !!process.env.TAVILY_API_KEY,
        cron:
          !!process.env.GOOGLE_REFRESH_TOKEN_ENCRYPTED &&
          !!process.env.CRON_SECRET,
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Erreur de lecture" },
      { status: e instanceof AuthError ? 401 : 503 },
    );
  }
}
