'use client';
import { FormEvent, useState } from 'react';

export function OpportunityCapture() {
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); setBusy(true); setMessage('');
    const form=new FormData(e.currentTarget);
    const payload={
      company:String(form.get('company')||'').trim(),
      jobTitle:String(form.get('jobTitle')||'').trim(),
      officialUrl:String(form.get('officialUrl')||'').trim(),
      location:String(form.get('location')||'').trim(),
      jobSnapshot:String(form.get('jobSnapshot')||'').trim(),
      priority:String(form.get('priority')||'B'),
      vertical:[String(form.get('vertical')||'M&A / IB')],
    };
    const res=await fetch('/api/applications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await res.json(); setBusy(false);
    if(!res.ok){setMessage(data.error||'Impossible d’ajouter l’offre.');return;}
    location.href=`/applications/${data.id}`;
  }

  return <div>
    <button className="button primary" onClick={()=>setOpen(v=>!v)}>{open?'Fermer':'Ajouter une offre'}</button>
    {open&&<form className="capture-form panel" onSubmit={submit}>
      <div className="form-grid">
        <label>Société<input name="company" required placeholder="Lazard"/></label>
        <label>Poste<input name="jobTitle" required placeholder="Investment Banking Intern"/></label>
        <label>URL officielle<input name="officialUrl" type="url" placeholder="https://…"/></label>
        <label>Localisation<input name="location" placeholder="Paris"/></label>
        <label>Verticale<select name="vertical" defaultValue="M&A / IB"><option>Private Equity</option><option>Hedge Fund / Public Markets</option><option>Private Credit</option><option>M&A / IB</option><option>Corporate Development</option><option>Transaction Services</option><option>Asset Management</option><option>Venture Capital</option></select></label>
        <label>Priorité<select name="priority" defaultValue="B"><option>A</option><option>B</option><option>C</option></select></label>
      </div>
      <label>Description de l’offre<textarea name="jobSnapshot" rows={8} placeholder="Colle ici la fiche de poste si l’URL n’est pas publiquement lisible."/></label>
      <div className="row"><button className="button primary" disabled={busy}>{busy?'Ajout…':'Créer et ouvrir la fiche'}</button>{message&&<span className="muted">{message}</span>}</div>
    </form>}
  </div>;
}
