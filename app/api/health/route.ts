import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(){
  const config={
    openai:!!process.env.OPENAI_API_KEY,
    googleOAuth:!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),
    googleBackground:!!process.env.GOOGLE_REFRESH_TOKEN,
    sheetsPinned:!!process.env.GOOGLE_SPREADSHEET_ID,
    tavily:!!process.env.TAVILY_API_KEY,
    sessionSecret:!!process.env.APP_SESSION_SECRET,
    cronSecret:!!process.env.CRON_SECRET,
    appUrl:!!process.env.APP_URL,
  };
  const productionReady=config.openai&&config.googleOAuth&&config.sessionSecret&&config.appUrl;
  return NextResponse.json({ok:true,service:'ubique',mode:productionReady?'connected-ready':'demo-or-partial',config,commit:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,8)||null},{headers:{'Cache-Control':'no-store'}});
}
