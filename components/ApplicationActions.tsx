'use client';
import { useState } from 'react';

export function ApplicationActions({id, hasEmail}:{id:string;hasEmail:boolean}) {
  const [busy,setBusy]=useState<string|null>(null);
  const [message,setMessage]=useState('');
  async function run(action:string) {
    setBusy(action); setMessage('');
    const res = await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,applicationId:id})});
    const data = await res.json();
    setMessage(res.ok ? (data.message || 'Terminé') : (data.error || 'Erreur'));
    setBusy(null);
    if (res.ok && action==='prepare') location.reload();
  }
  return <div className="action-panel">
    <button className="button primary" onClick={()=>run('prepare')} disabled={!!busy}>{busy==='prepare'?'Préparation…':'Préparer la candidature'}</button>
    <button className="button" onClick={()=>run('draft')} disabled={!!busy || !hasEmail}>{busy==='draft'?'Création…':'Créer brouillon Gmail'}</button>
    <button className="button" onClick={()=>run('mark-sent')} disabled={!!busy}>Marquer envoyée</button>
    {message && <span className="action-message">{message}</span>}
  </div>
}
