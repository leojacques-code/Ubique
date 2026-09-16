import Link from 'next/link';
import { ReactNode } from 'react';

const nav = [
  ['/', 'Dashboard'],['/opportunities','Opportunités'],['/pipeline','Pipeline'],['/contacts','Contacts'],['/documents','Documents'],['/watch','Veille'],['/analytics','Analytics'],['/profile','Profil'],['/settings','Paramètres']
];

export function Shell({children}:{children:ReactNode}) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">U</span><div><strong>Ubique</strong><small>Application CRM</small></div></div>
      <nav>{nav.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      <div className="sidebar-bottom"><a className="button ghost" href="/api/auth/google/start">Connecter Google</a></div>
    </aside>
    <main className="main"><header className="topbar"><div><strong>Finance applications</strong><span className="muted">Paris · Janvier 2027</span></div><div className="status-pill">AUTO PREP · HUMAN SEND</div></header>{children}</main>
  </div>
}
