import {
  oauthConfigured,
  sessionConfigured,
  backgroundConfigured,
} from "@/lib/config";
import { aiConfigured } from "@/lib/services/aiConfig";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = {
    ai: aiConfigured(),
    openrouter: !!process.env.OPENROUTER_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    googleOAuth: oauthConfigured(),
    googleBackground: backgroundConfigured(),
    sheetsPinned: !!process.env.GOOGLE_SPREADSHEET_ID,
    tavily: !!process.env.TAVILY_API_KEY,
    sessionSecret: sessionConfigured(),
    cronSecret: !!process.env.CRON_SECRET,
    appUrl: !!process.env.APP_URL,
  };
  const productionReady =
    config.ai &&
    config.googleOAuth &&
    config.sessionSecret &&
    config.appUrl;
  return NextResponse.json(
    {
      ok: true,
      service: "ubique",
      mode: productionReady ? "connected-ready" : "demo-or-partial",
      config,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
