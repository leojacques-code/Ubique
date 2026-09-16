import { getOwnerSession } from '@/lib/authz';

const ok=(value?:string|boolean)=>value?'Configuré':'À configurer';

export default async function Settings(){
  const session=await getOwnerSession();
  const googleOAuth=!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
  const ownerGuard=!!process.env.ALLOWED_GOOGLE_EMAIL;
  const sessionSecret=!!process.env.APP_SESSION_SECRET;
  const canConnectGoogle=googleOAuth&&ownerGuard&&sessionSecret;
  const rows=[
    ['URL application',ok(process.env.APP_URL)],
    ['Chiffrement de session',ok(sessionSecret)],
    ['Compte propriétaire autorisé',ok(ownerGuard)],
    ['OpenAI',ok(process.env.OPENAI_API_KEY)],
    ['Modèle OpenAI principal',ok(process.env.OPENAI_MODEL)],
    ['Modèle OpenAI rapide',ok(process.env.OPENAI_FAST_MODEL)],
    ['Google OAuth',ok(googleOAuth)],
    ['Session Google active',session?'Connecté':'Non connecté'],
    ['Google background refresh token',ok(process.env.GOOGLE_REFRESH_TOKEN)],
    ['Google Sheet épinglé',process.env.GOOGLE_SPREADSHEET_ID?'Configuré':'Auto-détection / création'],
    ['Tavily web research',ok(process.env.TAVILY_API_KEY)],
    ['Cron secret',ok(process.env.CRON_SECRET)]
  ];
  return <div className="page">
    <div className="page-head"><div><h1>Paramètres</h1><p>État des intégrations sans exposer aucune valeur sensible.</p></div>{canConnectGoogle?<a className="button primary" href="/api/auth/google/start">{session?'Reconnecter Google':'Connecter Google'}</a>:<span className="button" aria-disabled="true">Google à configurer</span>}</div>
    <div className="panel"><div className="list">{rows.map(([k,v])=><div className="list-item" key={String(k)}><strong>{k}</strong><span className="badge">{v}</span></div>)}</div></div>
    {!canConnectGoogle&&<div className="notice" style={{marginTop:16}}>Pour activer Google en production, configure le client OAuth, l’adresse propriétaire autorisée et le secret de session. Le mode démo reste en lecture seule.</div>}
    <div className="notice" style={{marginTop:16}}>Aucun email ni candidature n’est envoyé automatiquement. Ubique prépare, recherche, classe et crée des brouillons ; l’envoi reste humain.</div>
  </div>;
}
