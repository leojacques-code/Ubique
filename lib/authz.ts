import { getSession } from './session';

export async function getOwnerSession(){
  const session=await getSession();
  if(!session)return null;
  const allowed=process.env.ALLOWED_GOOGLE_EMAIL?.trim().toLowerCase();
  if(allowed&&session.email.trim().toLowerCase()!==allowed)return null;
  return session;
}

export async function isOwnerRequest(){
  return !!(await getOwnerSession());
}
