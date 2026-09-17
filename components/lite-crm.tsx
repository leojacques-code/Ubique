"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BriefcaseBusiness,
  Check,
  ChevronRight,
  LoaderCircle,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Settings as SettingsIcon,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  defaultProfile,
  defaultSettings,
  type Application,
  type Document,
  type Profile,
  type Snapshot,
} from "@/lib/types";

type View = "Nouvelle candidature" | "Candidatures" | "Contacts" | "Paramètres";

const blank: Snapshot = {
  applications: [],
  contacts: [],
  documents: [],
  interactions: [],
  profile: defaultProfile,
  settings: defaultSettings,
  logs: [],
  connections: {},
  email: "",
  demo: false,
};

function initialLiteView(value?: string): View {
  if (value === "Contacts") return "Contacts";
  if (value === "Paramètres" || value === "Profil" || value === "Documents") return "Paramètres";
  if (value === "Opportunités" || value === "Pipeline" || value === "Candidatures") return "Candidatures";
  return "Nouvelle candidature";
}

function Tag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

function date(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

function latest(docs: Document[]) {
  return [...docs].sort((a, b) => b.version - a.version || b.createdAt.localeCompare(a.createdAt))[0];
}

export default function LiteCRM({
  initialView,
  signedIn,
  configured,
  configuration,
}: {
  initialView?: string;
  initialId?: string;
  signedIn: boolean;
  demoEnabled?: boolean;
  configured: boolean;
  configuration: Record<string, boolean>;
}) {
  const [data, setData] = useState<Snapshot>(blank);
  const [view, setView] = useState<View>(initialLiteView(initialView));
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(signedIn);
  const [draftProfile, setDraftProfile] = useState<Profile>(defaultProfile);

  const load = useCallback(async () => {
    if (!signedIn) return;
    setLoading(true);
    try {
      const r = await fetch("/api/snapshot", { cache: "no-store" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Lecture impossible");
      setData(json);
      setDraftProfile(json.profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture impossible");
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(action: string, payload: Record<string, unknown> = {}) {
    if (busy) return null;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Action impossible");
      await load();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function prepare(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    setBusy("prepare");
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/lite/prepare", {
        method: "POST",
        body: new FormData(form),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Préparation impossible");
      await load();
      setSelected(result.application.id);
      setView("Candidatures");
      setNotice(
        result.recipient
          ? `Candidature prête. Brouillon Gmail créé pour ${result.recipient}, avec le CV et la LM joints.`
          : "Candidature prête. Brouillon Gmail créé avec le CV et la LM joints ; ajoutez simplement le destinataire dans Gmail.",
      );
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Préparation impossible");
    } finally {
      setBusy("");
    }
  }

  async function uploadCv(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    setBusy("cv");
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/lite/cv", { method: "POST", body: new FormData(form) });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Import impossible");
      await load();
      setNotice(`CV ${result.doc.cvLanguage} enregistré. Il devient la version la plus récente pour cette langue.`);
      form.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setBusy("");
    }
  }

  async function syncGmail() {
    const r = await action("sync");
    if (r) setNotice("Gmail synchronisé. Les réponses associées aux candidatures ont été mises à jour.");
  }

  const apps = useMemo(
    () => data.applications.filter((a) => !a.isWatch && !a.ignored).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.applications],
  );
  const app = apps.find((a) => a.id === selected);
  const appDocs = app ? data.documents.filter((d) => d.applicationId === app.id) : [];
  const interactions = app
    ? data.interactions
        .filter((i) => i.applicationId === app.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const latestFr = latest(data.documents.filter((d) => d.type === "CV" && d.cvLanguage === "FR"));
  const latestEn = latest(data.documents.filter((d) => d.type === "CV" && d.cvLanguage === "EN"));

  async function markSent(a: Application) {
    const lm = latest(data.documents.filter((d) => d.applicationId === a.id && d.type === "LM"));
    const cv = data.documents.find((d) => d.type === "CV" && d.filename === a.cvVersion) || latest(data.documents.filter((d) => d.type === "CV"));
    if (!lm || !cv) {
      setError("Impossible d'identifier les versions du CV et de la LM utilisées.");
      return;
    }
    const result = await action("sent", { id: a.id, documentIds: [cv.id, lm.id] });
    if (result) setNotice("Candidature marquée comme envoyée. Le suivi Gmail peut maintenant mettre son statut à jour.");
  }

  async function saveProfile() {
    const result = await action("profile", { profile: draftProfile });
    if (result) setNotice("Informations candidat enregistrées.");
  }

  if (!signedIn) {
    return (
      <div className="login-page">
        <div className="login-brand"><span className="brand-icon">U</span>Ubique</div>
        <div className="login-card">
          <div className="eyebrow">CANDIDATURES FINANCE</div>
          <h1>Une offre. Un brouillon prêt.</h1>
          <p>Collez une offre ou importez son PDF. Ubique prépare la lettre, le mail et les pièces jointes, puis crée le brouillon dans Gmail.</p>
          {configured ? (
            <a className="button primary wide" href="/api/auth/login">Se connecter avec Google</a>
          ) : (
            <div className="setup-note"><strong>Connexion Google à terminer.</strong></div>
          )}
          <details>
            <summary>État de la configuration</summary>
            <ul>{Object.entries(configuration).map(([k, v]) => <li key={k}>{k} : {v ? "OK" : "à configurer"}</li>)}</ul>
          </details>
        </div>
      </div>
    );
  }

  const nav: { label: View; icon: typeof Plus }[] = [
    { label: "Nouvelle candidature", icon: Plus },
    { label: "Candidatures", icon: BriefcaseBusiness },
    { label: "Contacts", icon: Users },
    { label: "Paramètres", icon: SettingsIcon },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-icon">U</span><span>Ubique<span className="brand-sub">CANDIDATURES FINANCE</span></span></div>
        <div className="workspace"><span className="avatar tiny">{data.profile.name.slice(0, 1) || "L"}</span><span>Mon espace<small>{data.email}</small></span></div>
        <div className="nav-label">ESPACE DE TRAVAIL</div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} className={view === label ? "active" : ""} onClick={() => { setView(label); setSelected(""); }}>
              <Icon size={19} />{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="review-note"><Mail size={18} /><span>Jamais d’envoi automatique.<small>Ubique prépare, vous envoyez.</small></span></div>
          <button className="account" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.reload(); }}>
            <span className="avatar tiny">{data.profile.name.slice(0, 1) || "L"}</span><span>{data.profile.name || "Mon compte"}<small>Déconnexion Google</small></span><LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="breadcrumb">Mon espace <ChevronRight size={14} /><strong>{view}</strong></div>
          <Tag tone="green">Espace personnel</Tag>
        </header>
        <main>
          {error && <div role="alert" className="alert error"><X size={17} /><span>{error}</span><button className="icon-btn" onClick={() => setError("")}><X size={15} /></button></div>}
          {notice && <div role="status" className="alert success"><Check size={17} /><span>{notice}</span><button className="icon-btn" onClick={() => setNotice("")}><X size={15} /></button></div>}
          {busy && <div className="busy"><LoaderCircle size={17} className="spin" />{busy === "prepare" ? "Lecture de l'offre, rédaction et création du brouillon Gmail…" : "Traitement en cours…"}</div>}
          {loading ? (
            <div className="empty"><LoaderCircle className="spin" /><p>Chargement…</p></div>
          ) : view === "Nouvelle candidature" ? (
            <>
              <div className="page-heading"><div><div className="eyebrow">PARCOURS UNIQUE</div><h1>Préparer une candidature</h1><p>Une URL ou un PDF suffit. Le descriptif peut être ajouté si la page est protégée.</p></div></div>
              <div className="detail-grid">
                <section className="panel wide-panel">
                  <form onSubmit={prepare}>
                    <div className="form-grid">
                      <label>URL de l’offre<input name="url" type="url" placeholder="https://careers…" /></label>
                      <label>PDF / DOCX de l’offre<input name="file" type="file" accept=".pdf,.docx,.txt" /></label>
                    </div>
                    <label>Descriptif de l’offre <span className="muted">(facultatif si URL/PDF lisible)</span><textarea name="description" rows={8} placeholder="Collez ici le texte de l'offre si nécessaire…" /></label>
                    <div className="form-grid">
                      <label>CV<select name="cvPreference" defaultValue="AUTO"><option value="AUTO">Auto selon la langue</option><option value="FR">CV français</option><option value="EN">CV anglais</option></select></label>
                      <label>Email destinataire <span className="muted">(facultatif)</span><input name="recipient" type="email" placeholder="recrutement@entreprise.com" /></label>
                    </div>
                    <button className="primary" disabled={!!busy}><Mail size={17} />Préparer et créer le brouillon Gmail</button>
                  </form>
                </section>
                <section className="panel">
                  <h2>Ce qui sera fait</h2>
                  <p>1. Lire l’offre et choisir le CV FR/EN.</p>
                  <p>2. Rédiger une LM fidèle au CV et le mail.</p>
                  <p>3. Créer la LM en PDF.</p>
                  <p>4. Créer un brouillon Gmail avec CV + LM joints.</p>
                  <p className="small muted">Aucun email n’est envoyé automatiquement.</p>
                </section>
                <section className="panel">
                  <h2>CV disponibles</h2>
                  <p>FR : {latestFr ? <><strong>{latestFr.filename}</strong> · v{latestFr.version}</> : <span className="muted">à ajouter</span>}</p>
                  <p>EN : {latestEn ? <><strong>{latestEn.filename}</strong> · v{latestEn.version}</> : <span className="muted">à ajouter</span>}</p>
                  {(!latestFr || !latestEn) && <button onClick={() => setView("Paramètres")}><Upload size={16} />Ajouter mes CV</button>}
                </section>
              </div>
            </>
          ) : view === "Candidatures" ? (
            <>
              <div className="page-heading"><div><h1>Candidatures</h1><p>Votre historique et les réponses détectées dans Gmail.</p></div><button disabled={!!busy} onClick={syncGmail}><RefreshCw size={16} />Synchroniser Gmail</button></div>
              {!app ? (
                <section className="panel">
                  {apps.length ? apps.map((a) => {
                    const last = data.interactions.filter((i) => i.applicationId === a.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
                    return <button className="op-row" key={a.id} onClick={() => setSelected(a.id)}>
                      <span className="company-mark">{a.company.slice(0, 2).toUpperCase()}</span>
                      <span className="company-cell"><strong>{a.company}</strong><span>{a.jobTitle}</span></span>
                      <span className="hide-small">{a.applicationDate ? date(a.applicationDate) : "Préparée"}</span>
                      <span><Tag tone={a.status === "En process" || a.status === "Offre" ? "green" : a.status === "Refus" ? "red" : "neutral"}>{a.status}</Tag></span>
                      <span className="hide-small muted">{last?.summary || a.nextAction || "—"}</span>
                      <ChevronRight size={16} />
                    </button>;
                  }) : <div className="empty"><BriefcaseBusiness size={30} /><h3>Aucune candidature</h3><p>Préparez votre première offre.</p><button onClick={() => setView("Nouvelle candidature")}>Nouvelle candidature</button></div>}
                </section>
              ) : (
                <div className="detail-grid">
                  <section className="panel wide-panel">
                    <div className="panel-heading"><div><h1>{app.company}</h1><p>{app.jobTitle}{app.location ? ` · ${app.location}` : ""}</p></div><Tag tone={app.status === "En process" || app.status === "Offre" ? "green" : app.status === "Refus" ? "red" : "neutral"}>{app.status}</Tag></div>
                    {app.notes && <p>{app.notes}</p>}
                    <div className="flex wrap">
                      {app.officialUrl && <a className="button" href={app.officialUrl} target="_blank" rel="noreferrer">Voir l’offre</a>}
                      <a className="button primary" href="https://mail.google.com/mail/u/0/#drafts" target="_blank" rel="noreferrer"><Mail size={16} />Ouvrir Gmail</a>
                      {!app.applicationDate && <button disabled={!!busy} onClick={() => markSent(app)}><Check size={16} />J’ai envoyé</button>}
                      <button onClick={() => setSelected("")}>Retour à la liste</button>
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Documents</h2>
                    {latest(appDocs.filter((d) => d.type === "LM")) ? <><strong>Lettre de motivation</strong><p className="small muted">{latest(appDocs.filter((d) => d.type === "LM"))?.filename}</p>{latest(appDocs.filter((d) => d.type === "LM"))?.driveUrl && <a href={latest(appDocs.filter((d) => d.type === "LM"))?.driveUrl} target="_blank" rel="noreferrer">Ouvrir dans Drive</a>}</> : <p className="muted">Pas de LM.</p>}
                    {app.cvVersion && <p className="small">CV : {app.cvVersion}</p>}
                  </section>
                  <section className="panel">
                    <h2>Suivi</h2>
                    <p>Postulée : {app.applicationDate ? date(app.applicationDate) : "pas encore confirmée"}</p>
                    <p>Dernier échange : {app.lastInteraction ? date(app.lastInteraction) : "—"}</p>
                    <p>Action : {app.nextAction || "—"}</p>
                  </section>
                  <section className="panel wide-panel">
                    <div className="panel-heading"><h2>Historique</h2><button disabled={!!busy} onClick={syncGmail}><RefreshCw size={15} />Actualiser Gmail</button></div>
                    {interactions.length ? interactions.slice(0, 12).map((i) => <div className="feed-item" key={i.id}><Mail size={17} /><span><strong>{i.summary}</strong><small>{date(i.createdAt)}{i.suggestion ? ` · ${i.suggestion}` : ""}</small></span></div>) : <p className="muted">Aucun échange enregistré.</p>}
                  </section>
                </div>
              )}
            </>
          ) : view === "Contacts" ? (
            <>
              <div className="page-heading"><div><h1>Contacts</h1><p>Les personnes liées à vos candidatures et échanges Gmail.</p></div></div>
              <section className="panel">
                {data.contacts.length ? data.contacts.map((c) => <div className="doc-row" key={c.id}><UserRound size={20} /><div className="grow"><strong>{c.name || "Contact"}</strong><span className="muted">{c.company}{c.role ? ` · ${c.role}` : ""}</span></div><span>{c.email || "Email non renseigné"}</span>{c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}</div>) : <div className="empty"><Users size={30} /><h3>Aucun contact</h3><p>Les destinataires explicites des offres et les recruteurs associés apparaîtront ici.</p></div>}
              </section>
            </>
          ) : (
            <>
              <div className="page-heading"><div><h1>Paramètres</h1><p>Seulement vos CV, vos informations candidat et les connexions utiles.</p></div></div>
              <div className="detail-grid">
                <section className="panel">
                  <h2>CV français</h2>
                  {latestFr && <p><strong>{latestFr.filename}</strong><br /><span className="muted">Version {latestFr.version}</span></p>}
                  <form onSubmit={uploadCv}><input type="hidden" name="language" value="FR" /><label>Nouveau CV FR<input required name="file" type="file" accept=".pdf,.docx,.txt" /></label><button disabled={!!busy}><Upload size={16} />Importer</button></form>
                </section>
                <section className="panel">
                  <h2>CV anglais</h2>
                  {latestEn && <p><strong>{latestEn.filename}</strong><br /><span className="muted">Version {latestEn.version}</span></p>}
                  <form onSubmit={uploadCv}><input type="hidden" name="language" value="EN" /><label>Nouveau CV EN<input required name="file" type="file" accept=".pdf,.docx,.txt" /></label><button disabled={!!busy}><Upload size={16} />Importer</button></form>
                </section>
                <section className="panel">
                  <h2>Informations candidat</h2>
                  <label>Nom<input value={draftProfile.name} onChange={(e) => setDraftProfile({ ...draftProfile, name: e.target.value })} /></label>
                  <label>Disponibilité<input type="month" value={draftProfile.availability} onChange={(e) => setDraftProfile({ ...draftProfile, availability: e.target.value })} /></label>
                  <label>Convention de stage<select value={draftProfile.convention} onChange={(e) => setDraftProfile({ ...draftProfile, convention: e.target.value as Profile["convention"] })}><option value="UNKNOWN">À confirmer</option><option value="AVAILABLE">Disponible</option><option value="NOT_AVAILABLE">Non disponible</option></select></label>
                  <button className="primary" disabled={!!busy} onClick={saveProfile}>Enregistrer</button>
                </section>
                <section className="panel">
                  <h2>Connexions</h2>
                  {Object.entries(configuration).map(([name, ready]) => <div className="connection" key={name}><span>{name}</span><Tag tone={ready ? "green" : "amber"}>{ready ? "OK" : "À configurer"}</Tag></div>)}
                  <button className="margin-top" disabled={!!busy} onClick={syncGmail}><RefreshCw size={16} />Synchroniser Gmail maintenant</button>
                  <p className="small muted margin-top">Le suivi en arrière-plan nécessite le refresh token Google. Sans lui, la synchronisation manuelle fonctionne quand vous êtes connecté.</p>
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
