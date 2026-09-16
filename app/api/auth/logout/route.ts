import { NextRequest, NextResponse } from 'next/server'; import { sessionCookieName } from '@/lib/session';
export async function GET(req:NextRequest){const res=NextResponse.redirect(new URL('/',process.env.APP_URL||req.nextUrl.origin));res.cookies.delete(sessionCookieName);return res}
