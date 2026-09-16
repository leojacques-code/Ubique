import { NextRequest, NextResponse } from 'next/server'; import { runWatch } from '@/lib/watch';
function allowed(req:NextRequest){const secret=process.env.CRON_SECRET;if(!secret)return false;return req.headers.get('authorization')===`Bearer ${secret}`}
export async function GET(req:NextRequest){if(!allowed(req))return NextResponse.json({error:'Unauthorized'},{status:401});try{return NextResponse.json(await runWatch())}catch(e:any){return NextResponse.json({error:e.message},{status:500})}}
