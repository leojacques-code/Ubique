"use client";
import { useEffect, useState, useCallback, type FormEvent } from "react";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Columns3,
  Users,
  Files,
  Radio,
  Settings as SettingsIcon,
  Plus,
  Search,
  ArrowUpRight,
  ChevronRight,
  Check,
  Clock,
  RefreshCw,
  X,
  FileText,
  Mail,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  LogOut,
  Download,
  Copy,
  UserRound,
  Menu,
  LoaderCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  statuses,
  verticals,
  stages,
  defaultProfile,
  defaultSettings,
  type Snapshot,
  type Application,
  type Document,
  type Contact,
  type Profile,
  type Settings,
  type Mail as MailType,
} from "@/lib/types";
import { demoSnapshot } from "@/lib/demo";
import { businessDate } from "@/lib/client-utils";
type View =
  | "Dashboard"
  | "Opportunités"
  | "Pipeline"
  | "Contacts"
  | "Documents"
  | "Veille"
  | "Profil"
  | "Paramètres";
const nav = [
  ["Dashboard", LayoutDashboard],
  ["Opportunités", BriefcaseBusiness],
  ["Pipeline", Columns3],
  ["Contacts", Users],
  ["Documents", Files],
  ["Veille", Radio],
  ["Profil", UserRound],
  ["Paramètres", SettingsIcon],
] as const;
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
const date = (value: string) =>
  value
    ? new Date(value.length === 7 ? value + "-01" : value).toLocaleDateString(
        "fr-FR",
        { day: "numeric", month: "short", timeZone: "Europe/Paris" },
      )
    : "Non renseigné";
function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"tag " + tone}>{children}</span>;
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <BriefcaseBusiness size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function External({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  if (!/^https:\/\//.test(url)) return <span>{children}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {children}
      <ExternalLink size={13} />
    </a>
  );
}
export default function CRM({
  initialView,
  initialId,
  signedIn,
  demoEnabled,
  configured,
}: {
  initialView?: string;
  initialId?: string;
  signedIn: boolean;
  demoEnabled: boolean;
  configured: boolean;
}) {
  const [data, setData] = useState<Snapshot>(blank);
  const [demo, setDemo] = useState(false);
  const [view, setView] = useState<View>(
    nav.some(([label]) => label === initialView)
      ? (initialView as View)
      : "Dashboard",
  );
  const [selected, setSelected] = useState(initialId || "");
  const [tab, setTab] = useState("Synthèse");
  const [loading, setLoading] = useState(signedIn);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [vertical, setVertical] = useState("");
  const [priority, setPriority] = useState("");
  const [modal, setModal] = useState("");
  const [document, setDocument] = useState<Document | null>(null);
  const [editText, setEditText] = useState("");
  const [menu, setMenu] = useState(false);
  const [draftProfile, setDraftProfile] = useState<Profile>(defaultProfile);
  const [draftSettings, setDraftSettings] = useState<Settings>(defaultSettings);
  const [setupResult, setSetupResult] = useState("");
  const [mailCandidates, setMailCandidates] = useState<MailType[]>([]);
  const [assistant, setAssistant] = useState("");
  const [drag, setDrag] = useState("");
  useEffect(() => {
    if (!modal) return;
    const previous = window.document.activeElement as HTMLElement | null;
    const dialog = window.document.querySelector('[role="dialog"]');
    const getFocusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,select,a[href]",
        ) || [],
      );
    getFocusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal("");
      if (e.key === "Tab") {
        const list = getFocusable();
        const first = list[0],
          last = list[list.length - 1];
        if (e.shiftKey && window.document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && window.document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [modal]);
  const load = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const r = await fetch("/api/snapshot");
      const json = await r.json();
      if (!r.ok) throw new Error(json.error);
      setData(json);
      setDraftProfile(json.profile);
      setDraftSettings(json.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture impossible");
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);
  const persist = (next: Snapshot) => {
    setData(next);
    if (demo) localStorage.setItem("crm-demo-v1", JSON.stringify(next));
  };
  const startDemo = () => {
    let next = demoSnapshot();
    try {
      const saved = localStorage.getItem("crm-demo-v1");
      if (saved) next = JSON.parse(saved);
    } catch {}
    setDemo(true);
    setData(next);
    setDraftProfile(next.profile);
    setDraftSettings(next.settings);
    setLoading(false);
  };
  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (busy) return null;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      if (demo) {
        if (action === "update") {
          const p = payload.patch as Partial<Application>;
          persist({
            ...data,
            applications: data.applications.map((a) =>
              a.id === payload.id ? { ...a, ...p } : a,
            ),
          });
          return { ok: true };
        }
        if (action === "sent") {
          persist({
            ...data,
            applications: data.applications.map((a) =>
              a.id === payload.id
                ? {
                    ...a,
                    status: "Envoyée",
                    applicationDate: new Date().toISOString(),
                    nextAction: "Vérifier une relance",
                    nextActionDate: businessDate(new Date().toISOString()),
                  }
                : a,
            ),
          });
          return { ok: true };
        }
        if (action === "profile") {
          persist({ ...data, profile: payload.profile as Profile });
          return { ok: true };
        }
        if (action === "settings") {
          persist({ ...data, settings: payload.settings as Settings });
          return { ok: true };
        }
        throw new Error(
          "Le mode démo utilise uniquement des données fictives. Connectez Google pour cette action.",
        );
      }
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setNotice(
        action === "draft"
          ? "Brouillon créé dans Gmail. Relisez-le avant de l’envoyer."
          : action === "prepare"
            ? "Dossier préparé. Relisez les documents avant candidature."
            : "Enregistré.",
      );
      await load();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible");
      return null;
    } finally {
      setBusy("");
    }
  }
  const open = (id: string) => {
    setSelected(id);
    setTab("Synthèse");
    setAssistant("");
    setQuery("");
  };
  const navigate = (v: View) => {
    setView(v);
    setSelected("");
    setQuery("");
    setMenu(false);
  };
  const app = data.applications.find((a) => a.id === selected);
  const applications = data.applications.filter(
    (a) => !a.isWatch && !a.ignored,
  );
  const filtered = (watch = false) =>
    data.applications.filter(
      (a) =>
        a.isWatch === watch &&
        !a.ignored &&
        (!query ||
          [a.company, a.jobTitle, a.vertical]
            .join(" ")
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!vertical || a.vertical === vertical) &&
        (!priority || a.priority === priority),
    );
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Paris",
  });
  const actions = applications.filter(
    (a) =>
      a.status !== "Clôturée" &&
      a.status !== "Refus" &&
      ((a.nextActionDate && a.nextActionDate <= today) ||
        a.status === "Prête à envoyer"),
  );
  const appDocs = app
    ? data.documents.filter((d) => d.applicationId === app.id)
    : [];
  const appContacts = app
    ? data.contacts.filter((c) => c.company === app.company)
    : [];
  const filters = (
    <div className="filters">
      <div className="search">
        <Search size={17} />
        <input
          aria-label="Rechercher"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une société, un poste…"
        />
      </div>
      <select
        aria-label="Filtrer par verticale"
        value={vertical}
        onChange={(e) => setVertical(e.target.value)}
      >
        <option value="">Toutes les verticales</option>
        {verticals.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <select
        aria-label="Filtrer par priorité"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
      >
        <option value="">Toutes priorités</option>
        {["A", "B", "C"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </div>
  );
  function row(a: Application) {
    return (
      <button className="op-row" key={a.id} onClick={() => open(a.id)}>
        <span className={"company-mark color-" + a.priority}>
          {a.company.slice(0, 2).toUpperCase()}
        </span>
        <span className="company-cell">
          <strong>{a.company}</strong>
          <span>{a.jobTitle}</span>
        </span>
        <span className="hide-small">
          <Tag>{a.vertical}</Tag>
        </span>
        <span>
          <Tag tone={a.priority === "A" ? "blue" : "neutral"}>{a.priority}</Tag>
        </span>
        <span className="hide-small muted">
          {a.analysis
            ? Math.round(a.analysis.fitScore) + " / 100"
            : "À analyser"}
        </span>
        <span className="status-cell">
          <Tag
            tone={
              a.status === "En process"
                ? "green"
                : a.status === "Refus"
                  ? "red"
                  : "neutral"
            }
          >
            {a.status}
          </Tag>
        </span>
        <ChevronRight size={16} />
      </button>
    );
  }
  function documentsList(docs: Document[]) {
    return docs.length ? (
      <div className="doc-list">
        {docs.map((d) => (
          <div className="doc-row" key={d.id}>
            <FileText size={21} />
            <div className="grow">
              <strong>{d.filename}</strong>
              <span className="muted">
                {d.type} · version {d.version}
                {d.usedForApplication ? " · utilisée pour candidature" : ""}
              </span>
            </div>
            {d.driveUrl && <External url={d.driveUrl}>Drive</External>}
            <button
              className="subtle"
              onClick={() => {
                setDocument(d);
                setEditText(d.text);
                setModal("document");
              }}
            >
              Ouvrir
            </button>
          </div>
        ))}
      </div>
    ) : (
      <Empty
        title="Aucun document"
        text="Les CV importés et les versions de vos candidatures seront conservés ici."
      />
    );
  }
  function contactCard(c: Contact) {
    return (
      <div className="contact-card" key={c.id}>
        <div className="between">
          <div className="avatar">{c.name.slice(0, 1)}</div>
          {c.primary && <Tag tone="blue">Principal</Tag>}
        </div>
        <h3>{c.name}</h3>
        <p>{c.role}</p>
        <span className="muted">{c.company}</span>
        <p>{c.relevance}</p>
        {c.alumniSkema && <Tag>Alumni SKEMA</Tag>}
        <p className="small">
          {c.email || "Email non trouvé"}
          <br />
          <span className="muted">
            {c.emailStatus === "VERIFIED_PUBLIC"
              ? "Public vérifié"
              : c.emailStatus === "PROBABLE_PATTERN"
                ? "Probable, à vérifier"
                : "Non trouvé"}
          </span>
        </p>
        <div className="flex">
          {c.linkedin && <External url={c.linkedin}>LinkedIn</External>}
          {c.source && <External url={c.source}>Source</External>}
        </div>
      </div>
    );
  }
  async function addSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (demo) {
      const seed = demoSnapshot().applications[0];
      const a = {
        ...seed,
        id: crypto.randomUUID(),
        company: String(f.get("company") || "Entreprise de démonstration"),
        jobTitle: String(f.get("jobTitle") || "Analyste (démo)"),
        description: String(f.get("description") || ""),
        status: "À analyser" as const,
        sources: [],
        isWatch: false,
      };
      persist({ ...data, applications: [...data.applications, a] });
      setModal("");
      open(a.id);
      return;
    }
    const r = await act("add", {
      url: String(f.get("url") || ""),
      description: String(f.get("description") || ""),
      company: String(f.get("company") || ""),
      jobTitle: String(f.get("jobTitle") || ""),
    });
    if (r) {
      setModal("");
      open(r.id);
    }
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("upload");
    setError("");
    try {
      if (demo)
        throw new Error(
          "Connectez Google pour importer vos documents personnels.",
        );
      const f = new FormData(e.currentTarget);
      const r = await fetch("/api/profile-upload", { method: "POST", body: f });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await load();
      if (result.profile) {
        setDraftProfile((p) => ({
          ...p,
          name: result.profile.name,
          evidence: [...p.evidence, ...result.profile.evidence],
        }));
        setNotice(
          "CV importé. Relisez les preuves proposées puis enregistrez le profil.",
        );
      } else {
        setDraftProfile((p) => ({
          ...p,
          writingRules: p.writingRules + "\n" + result.text,
        }));
        setNotice(
          "Instructions importées. Relisez puis enregistrez le profil.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible");
    } finally {
      setBusy("");
    }
  }
  if (!signedIn && !demo)
    return (
      <div className="login-page">
        <div className="login-brand">
          <span className="brand-icon">U</span>Ubique
        </div>
        <div className="login-card">
          <div className="eyebrow">VOTRE PROCHAINE ÉTAPE</div>
          <h1>
            Une candidature.
            <br />
            Toutes les bonnes cartes.
          </h1>
          <p>
            Vos opportunités, vos preuves et vos échanges, réunis dans un espace
            personnel.
          </p>
          <div className="login-features">
            <span>
              <ShieldCheck size={18} />
              Accès à votre compte uniquement
            </span>
            <span>
              <FileText size={18} />
              Documents sourcés, versions conservées
            </span>
            <span>
              <Mail size={18} />
              Préparation automatique, envoi par vous
            </span>
          </div>
          {configured ? (
            <a className="button primary wide" href="/api/auth/login">
              Se connecter avec Google <ArrowUpRight size={17} />
            </a>
          ) : (
            <div className="setup-note">
              <strong>Votre espace attend sa connexion Google.</strong>
              <p>
                Renseignez les identifiants OAuth et le compte autorisé dans la
                configuration Vercel. Le guide fourni détaille ces étapes.
              </p>
            </div>
          )}
          {demoEnabled && (
            <button className="button wide" onClick={startDemo}>
              Explorer la démonstration
            </button>
          )}
          <p className="small muted">
            Un assistant OpenAI intégré. Aucune candidature envoyée
            automatiquement.
          </p>
        </div>
        <div className="login-caption">FINANCE · PARIS · JANVIER 2027</div>
      </div>
    );
  return (
    <div className="shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-icon">U</span>
          <span>
            Application<span className="brand-sub">PERSONAL CRM</span>
          </span>
        </div>
        <div className="workspace">
          <span className="avatar tiny">
            {data.profile.name.slice(0, 1) || "L"}
          </span>
          <span>
            {demo ? "Espace démo" : "Mon espace"}
            <small>Finance · Paris</small>
          </span>
          <ChevronRight size={14} />
        </div>
        <div className="nav-label">ESPACE DE TRAVAIL</div>
        <nav>
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={view === label && !selected ? "active" : ""}
              onClick={() => navigate(label)}
            >
              <Icon size={19} />
              {label}
              {label === "Veille" &&
                data.applications.some((a) => a.isWatch && !a.ignored) && (
                  <span className="nav-count">
                    {
                      data.applications.filter((a) => a.isWatch && !a.ignored)
                        .length
                    }
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="review-note">
            <ShieldCheck size={19} />
            <span>
              Vous gardez la main.<small>Préparer, relire, puis envoyer.</small>
            </span>
          </div>
          <button className="account" onClick={() => navigate("Paramètres")}>
            <span className="avatar tiny">
              {data.profile.name.slice(0, 1) || "L"}
            </span>
            <span>
              {data.profile.name || "Mon compte"}
              <small>{demo ? "Données fictives" : data.email}</small>
            </span>
            <SettingsIcon size={16} />
          </button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <button
            aria-label="Ouvrir la navigation"
            className="icon-btn mobile-only"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            Mon espace <ChevronRight size={14} />
            <strong>{app ? app.company : view}</strong>
          </div>
          <div className="top-right">
            <span className="muted hide-small">Objectif janvier 2027</span>
            <Tag tone={demo ? "amber" : "green"}>
              {demo ? "Démonstration" : "Espace personnel"}
            </Tag>
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <span>
                <AlertCircle size={16} />
                Données fictives. Les changements restent dans ce navigateur.
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem("crm-demo-v1");
                  setData(demoSnapshot());
                }}
              >
                Réinitialiser
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="alert error">
              <AlertCircle size={18} />
              <span>{error}</span>
              <button aria-label="Fermer l’erreur" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="alert success">
              <Check size={18} />
              <span>{notice}</span>
              <button
                aria-label="Fermer la notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {busy && (
            <div role="status" className="busy">
              <LoaderCircle size={17} className="spin" />
              {busy === "prepare"
                ? "Recherche, vérification des preuves et rédaction en cours…"
                : "Traitement en cours…"}
              <span className="muted">Vous pouvez rester sur cette page.</span>
            </div>
          )}
          {loading ? (
            <div className="empty">
              <LoaderCircle className="spin" />
              <p>Chargement de votre espace…</p>
            </div>
          ) : app ? (
            <>
              <button className="back" onClick={() => setSelected("")}>
                <ArrowLeft size={16} />
                Retour aux opportunités
              </button>
              <div className="page-heading">
                <div className="flex">
                  <span className="company-mark large">
                    {app.company.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="eyebrow">{app.vertical}</div>
                    <h1>{app.company}</h1>
                    <p>
                      {app.jobTitle} · {app.location || "Lieu à vérifier"}
                    </p>
                  </div>
                </div>
                <div className="flex wrap">
                  {app.officialUrl && (
                    <External url={app.officialUrl}>Ouvrir l’offre</External>
                  )}
                  <button
                    className="primary"
                    disabled={!!busy}
                    onClick={() => act("prepare", { id: app.id })}
                  >
                    <Sparkles size={16} />
                    Préparer
                  </button>
                </div>
              </div>
              <div className="summary-strip">
                <div>
                  <label>Statut</label>
                  <select
                    aria-label="Statut du dossier"
                    value={app.status}
                    onChange={(e) =>
                      act("update", {
                        id: app.id,
                        patch: { status: e.target.value },
                      })
                    }
                  >
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Priorité carrière</label>
                  <select
                    aria-label="Priorité carrière"
                    value={app.priority}
                    onChange={(e) =>
                      act("update", {
                        id: app.id,
                        patch: { priority: e.target.value },
                      })
                    }
                  >
                    {["A", "B", "C"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Fit indicatif</label>
                  <strong>
                    {app.analysis
                      ? app.analysis.fitScore + " / 100"
                      : "Non évalué"}
                  </strong>
                </div>
                <div>
                  <label>Début</label>
                  <strong>{app.startDate || "À confirmer"}</strong>
                </div>
                <div>
                  <label>Contrat</label>
                  <strong>{app.contractType || "À confirmer"}</strong>
                </div>
                <div>
                  <label>CV conseillé</label>
                  <strong>{app.analysis?.cvLanguage || "À analyser"}</strong>
                </div>
              </div>
              <div className="tabs">
                {[
                  "Synthèse",
                  "Preuves",
                  "Documents",
                  "Contacts",
                  "Gmail",
                  "Historique",
                  "Offre",
                ].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={tab === t ? "selected" : ""}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {tab === "Synthèse" && (
                <div className="detail-grid">
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Pourquoi ce poste</h2>
                      <Tag>Priorité {app.priority}</Tag>
                    </div>
                    {app.analysis ? (
                      <>
                        <p>{app.analysis.summary}</p>
                        {[
                          ["Missions", app.analysis.missions],
                          ["Prérequis", app.analysis.mustHave],
                          ["Atouts souhaités", app.analysis.niceToHave],
                          [
                            "Tests recruteur à préparer (inférés)",
                            app.analysis.recruiterTests,
                          ],
                          [
                            "Calendrier et convention",
                            app.analysis.timingIssues || [],
                          ],
                        ].map(([label, items]) => (
                          <div key={String(label)}>
                            <h3>{String(label)}</h3>
                            <ul>
                              {(items as string[]).map((item, i) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        <h3>Ce qui correspond</h3>
                        <ul>
                          {app.analysis.strengths.slice(0, 3).map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                        <h3>Vigilances</h3>
                        <ul className="caution-list">
                          {app.analysis.gaps.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                        <h3>Approche recommandée</h3>
                        <p>{app.analysis.strategy}</p>
                        <h3>Faits entreprise</h3>
                        {app.analysis.companyFacts.map((s, i) => (
                          <p key={i}>
                            {s.fact}{" "}
                            <External url={s.sourceUrl}>Source</External>
                          </p>
                        ))}
                      </>
                    ) : (
                      <Empty
                        title="Un dossier à préparer"
                        text="L’analyse s’appuiera sur vos CV, des sources publiques et votre historique Gmail."
                        action={
                          <button
                            disabled={!!busy}
                            onClick={() => act("prepare", { id: app.id })}
                          >
                            <Sparkles size={16} />
                            Préparer la candidature
                          </button>
                        }
                      />
                    )}
                  </section>
                  <div className="stack">
                    <section className="panel">
                      <h2>Prochaine action</h2>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void act("update", {
                            id: app.id,
                            patch: {
                              nextAction: f.get("action"),
                              nextActionDate: f.get("date"),
                              stage: f.get("stage"),
                            },
                          });
                        }}
                      >
                        <label>
                          Action
                          <input name="action" defaultValue={app.nextAction} />
                        </label>
                        <label>
                          Date
                          <input
                            type="date"
                            name="date"
                            defaultValue={app.nextActionDate}
                          />
                        </label>
                        <label>
                          Étape
                          <select name="stage" defaultValue={app.stage}>
                            {stages.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <button disabled={!!busy}>Enregistrer</button>
                      </form>
                    </section>
                    <section className="panel">
                      <h2>Passer à l’action</h2>
                      <div className="action-buttons">
                        <button
                          onClick={() => setModal("sent")}
                          disabled={!!app.applicationDate}
                        >
                          <Check size={16} />
                          {app.applicationDate
                            ? "Candidature déclarée le " +
                              date(app.applicationDate)
                            : "Confirmer mon dépôt"}
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() =>
                            act("write", { id: app.id, kind: "Relance" })
                          }
                        >
                          <Mail size={16} />
                          Générer une relance
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() =>
                            act("write", { id: app.id, kind: "Entretien" })
                          }
                        >
                          <UserRound size={16} />
                          Préparer l’entretien
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() =>
                            act("write", { id: app.id, kind: "Remerciement" })
                          }
                        >
                          Générer un remerciement
                        </button>
                        <button onClick={() => setModal("form")}>
                          Répondre à un formulaire
                        </button>
                        <button
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              JSON.stringify(
                                {
                                  app,
                                  contacts: appContacts,
                                  documents: appDocs,
                                  profile: data.profile,
                                },
                                null,
                                2,
                              ),
                            );
                            setNotice("Contexte copié.");
                          }}
                        >
                          <Copy size={16} />
                          Copier le contexte ChatGPT
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <h2>Assistant du dossier</h2>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        const r = await act("assistant", {
                          id: app.id,
                          question: f.get("question"),
                        });
                        if (r) setAssistant(r.text);
                      }}
                    >
                      <label>
                        Votre question
                        <textarea
                          name="question"
                          placeholder="Quels points de mon CV faut-il préparer pour l’entretien ?"
                          required
                        />
                      </label>
                      <button disabled={!!busy}>
                        <Sparkles size={16} />
                        Demander
                      </button>
                    </form>
                    {assistant && <p className="preserve">{assistant}</p>}
                  </section>
                  <section className="panel">
                    <h2>Notes personnelles</h2>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act("update", {
                          id: app.id,
                          patch: {
                            notes: new FormData(e.currentTarget).get("notes"),
                          },
                        });
                      }}
                    >
                      <textarea
                        name="notes"
                        defaultValue={app.notes}
                        aria-label="Notes personnelles"
                        rows={6}
                      />
                      <button disabled={!!busy}>Enregistrer les notes</button>
                    </form>
                  </section>
                </div>
              )}
              {tab === "Preuves" && (
                <section className="panel">
                  <h2>Exigences ↔ preuves exactes</h2>
                  {!!app.legacyEvidenceMap?.length && (
                    <details>
                      <summary>
                        Preuves historiques importées, à rapprocher du profil
                        validé
                      </summary>
                      {app.legacyEvidenceMap.map((e, i) => (
                        <p key={i}>
                          {e.requirement} · {e.evidenceType} · {e.evidence} ·
                          Source : {e.source}
                        </p>
                      ))}
                    </details>
                  )}
                  {app.analysis ? (
                    <>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Exigence</th>
                              <th>Type de correspondance</th>
                              <th>Preuves du profil</th>
                              <th>Analyse</th>
                            </tr>
                          </thead>
                          <tbody>
                            {app.analysis.matches.map((m, i) => (
                              <tr key={i}>
                                <td>{m.requirement}</td>
                                <td>
                                  <Tag
                                    tone={
                                      m.type === "NOT_DEMONSTRATED"
                                        ? "amber"
                                        : m.type === "DIRECT"
                                          ? "green"
                                          : "neutral"
                                    }
                                  >
                                    {m.type}
                                  </Tag>
                                </td>
                                <td>
                                  {m.evidenceIds.map((id) => {
                                    const ev = data.profile.evidence.find(
                                      (e) => e.id === id,
                                    );
                                    return (
                                      <p key={id}>
                                        {ev?.fact}
                                        <br />
                                        <small>{ev?.source}</small>
                                      </p>
                                    );
                                  })}
                                </td>
                                <td>{m.explanation}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <h3>Ce que le recruteur teste</h3>
                      <ul>
                        {app.analysis.recruiterTests.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                      <h3>À ne pas affirmer</h3>
                      <ul>
                        {app.analysis.forbiddenClaims.map((s) => (
                          <li key={s}>{s}</li>
                        ))}
                      </ul>
                      <h3>Détail du fit</h3>
                      <div className="fit-grid">
                        {app.analysis.fitDetails.map((s) => (
                          <div key={s.dimension}>
                            <strong>
                              {s.score}/10 · {s.dimension}
                            </strong>
                            <p>{s.reason}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <Empty
                      title="Les preuves apparaîtront ici"
                      text="Préparez la candidature pour comparer chaque exigence à votre parcours."
                    />
                  )}
                </section>
              )}
              {tab === "Documents" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Documents du dossier</h2>
                    <button
                      disabled={!!busy}
                      onClick={() =>
                        act("prepare", { id: app.id, force: true })
                      }
                    >
                      <RefreshCw size={15} />
                      Nouvelle version
                    </button>
                  </div>
                  {documentsList(appDocs)}
                  <h3>CV disponibles</h3>
                  {documentsList(data.documents.filter((d) => d.type === "CV"))}
                </section>
              )}
              {tab === "Contacts" && (
                <>
                  <div className="panel-heading">
                    <h2>Une approche ciblée</h2>
                    <button onClick={() => setModal("contact")}>
                      <Plus size={16} />
                      Ajouter un contact
                    </button>
                  </div>
                  <div className="contact-grid">
                    {appContacts.map(contactCard)}
                  </div>
                  {!appContacts.length && (
                    <Empty
                      title="Aucun contact vérifié"
                      text="La préparation recherche des interlocuteurs publics. Vous pouvez aussi ajouter un contact sourcé."
                    />
                  )}
                </>
              )}
              {tab === "Gmail" && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Historique avec {app.company}</h2>
                      <p className="muted small">
                        {app.gmailCheckedAt
                          ? "Vérifié le " +
                            date(app.gmailCheckedAt) +
                            " · extraits des 10 messages récents conservés"
                          : "Pas encore vérifié"}
                      </p>
                    </div>
                    <button
                      disabled={!!busy}
                      onClick={() => act("history", { id: app.id })}
                    >
                      <RefreshCw size={16} />
                      Vérifier Gmail
                    </button>
                  </div>
                  {app.gmailHistory?.length ? (
                    app.gmailHistory.map((m) => (
                      <div className="mail-row" key={m.id}>
                        <Mail size={18} />
                        <div>
                          <strong>{m.subject}</strong>
                          <p className="small muted">
                            {m.from} · {date(m.date)}
                          </p>
                          <p>{m.text}</p>
                          <External
                            url={
                              "https://mail.google.com/mail/u/0/#all/" +
                              m.threadId
                            }
                          >
                            Ouvrir le fil
                          </External>
                        </div>
                      </div>
                    ))
                  ) : (
                    <Empty
                      title={
                        app.gmailCheckedAt
                          ? "Aucun échange trouvé dans cette recherche"
                          : "Historique non vérifié"
                      }
                      text="Vérifiez l’historique avant de choisir votre approche."
                    />
                  )}
                </section>
              )}
              {tab === "Historique" && (
                <section className="panel">
                  <h2>Chaque étape, conservée</h2>
                  {data.interactions
                    .filter((i) => i.applicationId === app.id)
                    .reverse()
                    .map((i) => (
                      <div className="timeline-row" key={i.id}>
                        <span className="timeline-dot" />
                        <div>
                          <strong>{i.type}</strong>
                          <small>{date(i.createdAt)}</small>
                          <p>{i.summary}</p>
                          {i.classification && (
                            <Tag>
                              {i.classification} ·{" "}
                              {Math.round((i.confidence || 0) * 100)} %
                            </Tag>
                          )}
                          {i.requiresReview && (
                            <div className="review-callout">
                              <p>À valider : {i.suggestion}</p>
                              <span>
                                Modifiez le statut du dossier après avoir relu
                                le message.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </section>
              )}
              {tab === "Offre" && (
                <div className="detail-grid">
                  <section className="panel">
                    <h2>Texte de référence</h2>
                    <p className="small muted">
                      Référence : {app.reference || "Non renseignée"} ·
                      Publication : {date(app.publicationDate)} · Limite :{" "}
                      {date(app.deadline)}
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void act("update", {
                          id: app.id,
                          patch: {
                            description: f.get("description"),
                            officialUrl: f.get("officialUrl"),
                          },
                        });
                      }}
                    >
                      <label>
                        URL officielle vérifiée
                        <input
                          name="officialUrl"
                          type="url"
                          defaultValue={app.officialUrl}
                        />
                      </label>
                      <label>
                        Texte de l’offre
                        <textarea
                          name="description"
                          rows={20}
                          defaultValue={app.description}
                        />
                      </label>
                      <button>Enregistrer</button>
                    </form>
                  </section>
                  <section className="panel">
                    <h2>Sources et occurrences</h2>
                    {app.sources.map((s, i) => (
                      <div className="source" key={i}>
                        <External url={s.url}>{s.title}</External>
                        <p>{s.content}</p>
                        <small className="muted">
                          Consulté le {date(s.checkedAt)} · à confronter à l’ATS
                          officiel
                        </small>
                      </div>
                    ))}
                  </section>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    {view === "Dashboard"
                      ? "VOTRE RECHERCHE, EN MOUVEMENT"
                      : "ESPACE DE TRAVAIL"}
                  </div>
                  <h1>
                    {view === "Dashboard" ? "L’essentiel, aujourd’hui." : view}
                  </h1>
                  <p>
                    {
                      (
                        {
                          Dashboard:
                            "Les bonnes opportunités. La prochaine action.",
                          Opportunités:
                            "Une fiche par opportunité, toutes les sources réunies.",
                          Pipeline:
                            "De la première analyse à votre prochaine offre.",
                          Contacts: "Le bon interlocuteur, au bon moment.",
                          Documents:
                            "Vos originaux et chaque version de candidature.",
                          Veille:
                            "Une sélection à qualifier, avant de rejoindre le pipeline.",
                          Profil:
                            "Votre parcours réel est la source de chaque candidature.",
                          Paramètres: "Vos connexions et vos préférences.",
                        } as Record<View, string>
                      )[view]
                    }
                  </p>
                </div>
                <div className="flex wrap">
                  {view === "Veille" ? (
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() => act("watch")}
                    >
                      <Radio size={16} />
                      Lancer la veille
                    </button>
                  ) : view === "Profil" || view === "Paramètres" ? null : (
                    <button className="primary" onClick={() => setModal("add")}>
                      <Plus size={17} />
                      Ajouter une offre
                    </button>
                  )}
                </div>
              </div>
              {view === "Dashboard" && (
                <>
                  <div className="metrics">
                    {[
                      [
                        "À préparer",
                        applications.filter((a) =>
                          ["À analyser", "À préparer"].includes(a.status),
                        ).length,
                        "Dossiers à travailler",
                      ],
                      [
                        "Prêtes à envoyer",
                        applications.filter(
                          (a) => a.status === "Prête à envoyer",
                        ).length,
                        "À relire et déposer",
                      ],
                      [
                        "En process",
                        applications.filter((a) => a.status === "En process")
                          .length,
                        "Entretiens et tests",
                      ],
                      [
                        "Relances dues",
                        actions.filter((a) => a.applicationDate).length,
                        "À vérifier aujourd’hui",
                      ],
                    ].map(([name, value, sub], i) => (
                      <button
                        key={name}
                        className={"metric m" + i}
                        onClick={() => navigate("Pipeline")}
                      >
                        <span>
                          {name}
                          <ArrowUpRight size={17} />
                        </span>
                        <strong>{value}</strong>
                        <small>{sub}</small>
                      </button>
                    ))}
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel today">
                      <div className="panel-heading">
                        <h2>
                          <span className="section-icon">
                            <Clock size={18} />
                          </span>
                          Aujourd’hui
                        </h2>
                        <Tag>
                          {actions.length} action{actions.length > 1 ? "s" : ""}
                        </Tag>
                      </div>
                      {actions.length ? (
                        actions.slice(0, 7).map((a) => (
                          <button
                            className="today-row"
                            onClick={() => open(a.id)}
                            key={a.id}
                          >
                            <div className="task-box">
                              <ArrowUpRight size={16} />
                            </div>
                            <div className="grow">
                              <strong>
                                {a.nextAction || "Relire la candidature"}
                              </strong>
                              <p>
                                {a.company} <span>· {a.jobTitle}</span>
                              </p>
                            </div>
                            <Tag tone={a.priority === "A" ? "blue" : "neutral"}>
                              {a.priority}
                            </Tag>
                            <ChevronRight size={16} />
                          </button>
                        ))
                      ) : (
                        <Empty
                          title="L’esprit libre pour avancer"
                          text="Les candidatures prêtes et les actions arrivées à échéance apparaîtront ici."
                          action={
                            <button onClick={() => setModal("add")}>
                              Ajouter votre première offre
                            </button>
                          }
                        />
                      )}
                    </section>
                    <section className="focus-panel">
                      <div className="eyebrow">VOTRE CAP</div>
                      <h2>
                        La qualité
                        <br />
                        fait la différence.
                      </h2>
                      <p>
                        Priorisez les dossiers qui vous font progresser. Chaque
                        candidature repose sur des preuves.
                      </p>
                      <div className="focus-item">
                        <span>01</span>
                        <strong>Private Equity</strong>
                      </div>
                      <div className="focus-item">
                        <span>02</span>
                        <strong>Public Markets</strong>
                      </div>
                      <div className="focus-item">
                        <span>03</span>
                        <strong>Private Credit</strong>
                      </div>
                      <div className="focus-item">
                        <span>04</span>
                        <strong>M&A / IB</strong>
                      </div>
                      <div className="focus-foot">
                        Paris <span>Janvier 2027</span>
                      </div>
                    </section>
                    <section className="panel wide-panel">
                      <div className="panel-heading">
                        <h2>Candidatures prioritaires</h2>
                        <button
                          className="text-btn"
                          onClick={() => navigate("Opportunités")}
                        >
                          Tout voir <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <div className="table-labels">
                        <span>ENTREPRISE / POSTE</span>
                        <span>VERTICALE</span>
                        <span>PRIORITÉ</span>
                        <span>FIT</span>
                        <span>STATUT</span>
                      </div>
                      {applications
                        .filter(
                          (a) =>
                            a.priority === "A" &&
                            !["Refus", "Clôturée"].includes(a.status),
                        )
                        .slice(0, 5)
                        .map(row)}
                      {!applications.some((a) => a.priority === "A") && (
                        <p className="muted">
                          Ajoutez une offre et attribuez-lui une priorité.
                        </p>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Dernières réponses</h2>
                        <button
                          className="icon-btn"
                          aria-label="Synchroniser Gmail"
                          disabled={!!busy}
                          onClick={() => act("sync")}
                        >
                          <RefreshCw size={16} />
                        </button>
                      </div>
                      {data.interactions
                        .filter((i) => i.type === "Gmail")
                        .slice(-4)
                        .reverse()
                        .map((i) => (
                          <button
                            className="feed-item"
                            key={i.id}
                            onClick={() => open(i.applicationId)}
                          >
                            <Mail size={18} />
                            <span>
                              <strong>{i.summary}</strong>
                              <small>{date(i.createdAt)}</small>
                            </span>
                          </button>
                        ))}
                      {!data.interactions.some((i) => i.type === "Gmail") && (
                        <p className="muted">
                          Les réponses associées à vos dossiers s’afficheront
                          après synchronisation.
                        </p>
                      )}
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>À découvrir</h2>
                        <button
                          className="text-btn"
                          onClick={() => navigate("Veille")}
                        >
                          Veille <ArrowUpRight size={16} />
                        </button>
                      </div>
                      {data.applications
                        .filter((a) => a.isWatch && !a.ignored)
                        .slice(0, 3)
                        .map((a) => (
                          <button
                            className="feed-item"
                            key={a.id}
                            onClick={() => open(a.id)}
                          >
                            <Radio size={18} />
                            <span>
                              <strong>{a.company}</strong>
                              <small>{a.jobTitle}</small>
                            </span>
                          </button>
                        ))}
                      {!data.applications.some((a) => a.isWatch) && (
                        <p className="muted">
                          Configurez la veille pour découvrir des offres
                          pertinentes.
                        </p>
                      )}
                    </section>
                  </div>
                  <div className="status-summary">
                    {["Envoyée", "Offre", "Refus", "Clôturée"].map((s) => (
                      <span key={s}>
                        {s}{" "}
                        <strong>
                          {applications.filter((a) => a.status === s).length}
                        </strong>
                      </span>
                    ))}
                  </div>
                </>
              )}
              {(view === "Opportunités" || view === "Veille") && (
                <>
                  {filters}
                  <section className="panel list-panel">
                    <div className="panel-heading">
                      <h2>
                        {view === "Veille"
                          ? "Nouvelles opportunités"
                          : "Tous les dossiers"}
                      </h2>
                      <Tag>{filtered(view === "Veille").length}</Tag>
                    </div>
                    {filtered(view === "Veille").map((a) => (
                      <div key={a.id}>
                        {row(a)}
                        {view === "Veille" && (
                          <div className="watch-actions">
                            <button
                              className="subtle"
                              onClick={() =>
                                act("update", {
                                  id: a.id,
                                  patch: { isWatch: false },
                                })
                              }
                            >
                              Ajouter au pipeline
                            </button>
                            <button
                              className="text-btn"
                              onClick={() =>
                                act("update", {
                                  id: a.id,
                                  patch: { ignored: true },
                                })
                              }
                            >
                              Ignorer
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {!filtered(view === "Veille").length && (
                      <Empty
                        title="Aucune opportunité à afficher"
                        text={
                          view === "Veille"
                            ? "Lancez la veille pour qualifier de nouvelles offres."
                            : "Ajoutez une URL ou collez une fiche de poste."
                        }
                        action={
                          <button onClick={() => setModal("add")}>
                            Ajouter une offre
                          </button>
                        }
                      />
                    )}
                  </section>
                  {view === "Opportunités" && (
                    <div className="flex margin-top">
                      <button onClick={() => setModal("import")}>
                        Importer un CSV / export Sheets
                      </button>
                      <button
                        disabled={!!busy}
                        onClick={async () => {
                          const r = await act("import-mail");
                          if (r) {
                            setMailCandidates(r.mails);
                            setModal("mail-import");
                          }
                        }}
                      >
                        Retrouver mes candidatures Gmail
                      </button>
                    </div>
                  )}
                </>
              )}
              {view === "Pipeline" && (
                <>
                  {filters}
                  <p className="muted small">
                    Déplacez une carte ou ouvrez un dossier pour changer son
                    statut.
                  </p>
                  <div className="kanban">
                    {statuses.map((s) => (
                      <section
                        key={s}
                        className="kanban-column"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (drag)
                            void act("update", {
                              id: drag,
                              patch: { status: s },
                            });
                          setDrag("");
                        }}
                      >
                        <div className="kanban-heading">
                          <span>{s}</span>
                          <span>
                            {filtered().filter((a) => a.status === s).length}
                          </span>
                        </div>
                        {filtered()
                          .filter((a) => a.status === s)
                          .map((a) => (
                            <button
                              draggable
                              onDragStart={() => setDrag(a.id)}
                              className="kanban-card"
                              key={a.id}
                              onClick={() => open(a.id)}
                            >
                              <div className="between">
                                <span className="company-mark small">
                                  {a.company.slice(0, 2).toUpperCase()}
                                </span>
                                <Tag
                                  tone={a.priority === "A" ? "blue" : "neutral"}
                                >
                                  {a.priority}
                                </Tag>
                              </div>
                              <strong>{a.company}</strong>
                              <p>{a.jobTitle}</p>
                              <Tag>{a.vertical}</Tag>
                              <div className="card-meta">
                                <Clock size={13} />
                                {a.nextActionDate
                                  ? date(a.nextActionDate)
                                  : "Date à définir"}
                              </div>
                              <p className="small">{a.nextAction}</p>
                              <div className="card-docs">
                                {["CV", "LM", "Email"].map((type) => (
                                  <span key={type}>
                                    {type}{" "}
                                    {data.documents.some(
                                      (d) =>
                                        (d.applicationId === a.id ||
                                          type === "CV") &&
                                        d.type === type,
                                    )
                                      ? "✓"
                                      : "–"}
                                  </span>
                                ))}
                              </div>
                            </button>
                          ))}
                      </section>
                    ))}
                  </div>
                </>
              )}
              {view === "Contacts" && (
                <>
                  <div className="panel-heading">
                    <div className="search">
                      <Search size={16} />
                      <input
                        aria-label="Rechercher un contact"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Nom, société…"
                      />
                    </div>
                    <button onClick={() => setModal("contact")}>
                      <Plus size={16} />
                      Ajouter
                    </button>
                  </div>
                  <div className="contact-grid">
                    {data.contacts
                      .filter((c) =>
                        (c.name + " " + c.company)
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map(contactCard)}
                  </div>
                  {!data.contacts.length && (
                    <Empty
                      title="Votre carnet de contacts"
                      text="Les interlocuteurs vérifiés s’ajoutent à partir des dossiers. Un contact principal par approche."
                    />
                  )}
                </>
              )}
              {view === "Documents" && (
                <section className="panel">
                  {documentsList(data.documents)}
                </section>
              )}
              {view === "Profil" && (
                <div className="detail-grid">
                  <section className="panel">
                    <h2>Vos sources</h2>
                    <p>
                      Importez les deux CV. Toutes les preuves extraites restent
                      à relire avant enregistrement.
                    </p>
                    <form onSubmit={upload}>
                      <label>
                        Document
                        <input
                          required
                          type="file"
                          name="file"
                          accept=".pdf,.docx,.txt"
                        />
                      </label>
                      <div className="form-grid">
                        <label>
                          Type
                          <select name="kind">
                            <option>CV</option>
                            <option>Instructions</option>
                            <option>Style</option>
                          </select>
                        </label>
                        <label>
                          Langue
                          <select name="language">
                            <option>FR</option>
                            <option>EN</option>
                          </select>
                        </label>
                      </div>
                      <button disabled={!!busy}>
                        <Plus size={16} />
                        Importer et analyser
                      </button>
                    </form>
                    <h3>Importer un profil vérifié</h3>
                    <input
                      aria-label="Importer profil JSON"
                      type="file"
                      accept=".json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          try {
                            const p = JSON.parse(await file.text());
                            if (!Array.isArray(p.evidence))
                              throw new Error("Profil invalide");
                            setDraftProfile({ ...defaultProfile, ...p });
                            setNotice(
                              "Profil chargé. Relisez puis enregistrez.",
                            );
                          } catch {
                            setError("Fichier de profil invalide.");
                          }
                      }}
                    />
                    <div className="review-callout">
                      Le CV prime sur les instructions. Un cours de LBO reste
                      une connaissance académique.
                    </div>
                  </section>
                  <section className="panel">
                    <h2>Informations de référence</h2>
                    <label>
                      Nom
                      <input
                        value={draftProfile.name}
                        onChange={(e) =>
                          setDraftProfile({
                            ...draftProfile,
                            name: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Disponibilité
                      <input
                        type="month"
                        value={draftProfile.availability}
                        onChange={(e) =>
                          setDraftProfile({
                            ...draftProfile,
                            availability: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Localisation
                      <input
                        value={draftProfile.location}
                        onChange={(e) =>
                          setDraftProfile({
                            ...draftProfile,
                            location: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Convention de stage
                      <select
                        value={draftProfile.convention}
                        onChange={(e) =>
                          setDraftProfile({
                            ...draftProfile,
                            convention: e.target.value as Profile["convention"],
                          })
                        }
                      >
                        <option value="UNKNOWN">À confirmer</option>
                        <option value="AVAILABLE">Disponible</option>
                        <option value="NOT_AVAILABLE">Non disponible</option>
                      </select>
                    </label>
                    <label>
                      Style rédactionnel
                      <textarea
                        rows={4}
                        value={draftProfile.writingRules}
                        onChange={(e) =>
                          setDraftProfile({
                            ...draftProfile,
                            writingRules: e.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() => act("profile", { profile: draftProfile })}
                    >
                      Valider et enregistrer le profil
                    </button>
                  </section>
                  <section className="panel wide-panel">
                    <div className="panel-heading">
                      <h2>Preuves du parcours</h2>
                      <Tag>{draftProfile.evidence.length} éléments</Tag>
                    </div>
                    {draftProfile.evidence.map((e, i) => (
                      <div className="evidence-row" key={e.id}>
                        <div>
                          <Tag>{e.category}</Tag>
                          <small>{e.source}</small>
                        </div>
                        <textarea
                          aria-label={"Preuve " + (i + 1)}
                          value={e.fact}
                          onChange={(ev) =>
                            setDraftProfile({
                              ...draftProfile,
                              evidence: draftProfile.evidence.map((x) =>
                                x.id === e.id
                                  ? { ...x, fact: ev.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                        <select
                          aria-label={"Type preuve " + (i + 1)}
                          value={e.type}
                          onChange={(ev) =>
                            setDraftProfile({
                              ...draftProfile,
                              evidence: draftProfile.evidence.map((x) =>
                                x.id === e.id
                                  ? {
                                      ...x,
                                      type: ev.target.value as typeof e.type,
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          {[
                            "DIRECT",
                            "TRANSFERABLE",
                            "ACADEMIC",
                            "NOT_DEMONSTRATED",
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                        <button
                          className="icon-btn"
                          aria-label={"Supprimer preuve " + (i + 1)}
                          onClick={() =>
                            setDraftProfile({
                              ...draftProfile,
                              evidence: draftProfile.evidence.filter(
                                (x) => x.id !== e.id,
                              ),
                            })
                          }
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    {!draftProfile.evidence.length && (
                      <p className="muted">
                        Importez votre CV ou le profil JSON fourni.
                      </p>
                    )}
                  </section>
                </div>
              )}
              {view === "Paramètres" && (
                <div className="detail-grid">
                  <section className="panel">
                    <h2>Connexions</h2>
                    {[
                      ["google", "Google · Gmail & Drive"],
                      ["sheets", "Google Sheets"],
                      ["openai", "OpenAI"],
                      ["search", "Recherche web"],
                      ["cron", "Synchronisation quotidienne"],
                    ].map(([k, label]) => (
                      <div className="connection" key={k}>
                        <span>{label}</span>
                        <Tag tone={data.connections[k] ? "green" : "amber"}>
                          {data.connections[k] ? "Configuré" : "À connecter"}
                        </Tag>
                      </div>
                    ))}
                    <p className="small muted">
                      Les secrets se renseignent dans les variables
                      d’environnement Vercel. Les connexions ChatGPT ne
                      connectent pas automatiquement ce site.
                    </p>
                    <div className="action-buttons">
                      <button
                        disabled={!!busy}
                        onClick={async () => {
                          const r = await act("initialize");
                          if (r)
                            setSetupResult(
                              `GOOGLE_SPREADSHEET_ID=${r.spreadsheetId}\nGOOGLE_DRIVE_FOLDER_ID=${r.folderId}`,
                            );
                        }}
                      >
                        Initialiser mon espace Google
                      </button>
                      <button disabled={!!busy} onClick={() => act("sync")}>
                        Synchroniser Gmail maintenant
                      </button>
                      <a className="button" href="/api/auth/login?labels=1">
                        Autoriser les labels Gmail
                      </a>
                    </div>
                    {setupResult && (
                      <>
                        <p>
                          Ajoutez ces deux valeurs à la configuration Vercel
                          puis redéployez.
                        </p>
                        <pre>{setupResult}</pre>
                      </>
                    )}
                    <h3>Confidentialité</h3>
                    <p className="small">
                      Seuls les messages recherchés pour vos dossiers sont
                      transmis à OpenAI pour analyse. Aucun email n’est envoyé,
                      supprimé ou archivé par l’application.
                    </p>
                    <button
                      onClick={async () => {
                        if (demo) {
                          setDemo(false);
                          return;
                        }
                        if (
                          !confirm(
                            "Déconnecter Google et révoquer l’autorisation ? Les synchronisations devront être reconnectées.",
                          )
                        )
                          return;
                        const r = await fetch("/api/auth/logout", {
                          method: "POST",
                        });
                        if (r.ok) location.reload();
                        else setError((await r.json()).error);
                      }}
                    >
                      <LogOut size={16} />
                      Déconnecter Google
                    </button>
                  </section>
                  <section className="panel">
                    <h2>Préférences</h2>
                    <label>
                      Localisations
                      <input
                        value={draftSettings.preferredLocations}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            preferredLocations: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Mots-clés positifs
                      <textarea
                        value={draftSettings.keywords}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            keywords: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Mots-clés à éviter
                      <input
                        value={draftSettings.negativeKeywords}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            negativeKeywords: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Sociétés exclues
                      <input
                        value={draftSettings.excludedCompanies}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            excludedCompanies: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Requêtes de veille (une par ligne)
                      <textarea
                        rows={5}
                        value={draftSettings.watchQueries.join("\n")}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            watchQueries: e.target.value.split("\n"),
                          })
                        }
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draftSettings.autoStatus}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            autoStatus: e.target.checked,
                          })
                        }
                      />
                      Mettre à jour les statuts à forte confiance
                    </label>
                    <label>
                      Seuil de confiance IA
                      <input
                        type="number"
                        min="0.85"
                        max="1"
                        step="0.01"
                        value={draftSettings.threshold}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            threshold: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draftSettings.gmailLabels}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            gmailLabels: e.target.checked,
                          })
                        }
                      />
                      Synchroniser les labels Gmail (autorisation
                      supplémentaire)
                    </label>
                    <button
                      className="primary"
                      disabled={!!busy}
                      onClick={() =>
                        act("settings", { settings: draftSettings })
                      }
                    >
                      Enregistrer les préférences
                    </button>
                  </section>
                  <section className="panel wide-panel">
                    <h2>Journal des synchronisations</h2>
                    {data.logs.length ? (
                      <table>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Date</th>
                            <th>Résultat</th>
                            <th>Éléments</th>
                            <th>Détail</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.logs.map((l) => (
                            <tr key={l.id}>
                              <td>{l.type}</td>
                              <td>{date(l.createdAt)}</td>
                              <td>{l.status}</td>
                              <td>{l.itemsProcessed}</td>
                              <td>{l.errors.join(" · ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="muted">Aucune synchronisation effectuée.</p>
                    )}
                    <button
                      className="danger"
                      onClick={() => {
                        if (
                          confirm(
                            "Supprimer les brouillons générés non utilisés du CRM ? Les originaux et fichiers Drive sont conservés.",
                          )
                        )
                          void act("clear-generated");
                      }}
                    >
                      Supprimer les brouillons inutilisés
                    </button>
                  </section>
                </div>
              )}
            </>
          )}
        </main>
        <footer>
          Ubique <span>Préparation automatique. Validation humaine.</span>
        </footer>
      </div>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={modal === "add" ? "Ajouter une offre" : "Éditeur"}
            className={
              "modal " + (modal === "document" ? "document-modal" : "")
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-btn"
              aria-label="Fermer"
              onClick={() => setModal("")}
            >
              <X size={20} />
            </button>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {busy && (
              <div className="busy" role="status">
                <LoaderCircle className="spin" size={16} />
                Traitement en cours…
              </div>
            )}
            {modal === "add" && (
              <>
                <div className="eyebrow">NOUVELLE OPPORTUNITÉ</div>
                <h2>Une offre. Un dossier.</h2>
                <p>
                  Collez un lien ou le texte complet. L’analyse reconstitue les
                  informations utiles.
                </p>
                <form onSubmit={addSubmit}>
                  {(demo || !data.connections.openai) && (
                    <div className="form-grid">
                      <label>
                        Société
                        <input name="company" required />
                      </label>
                      <label>
                        Poste
                        <input name="jobTitle" required />
                      </label>
                    </div>
                  )}
                  <label>
                    URL de l’offre
                    <input name="url" type="url" placeholder="https://…" />
                  </label>
                  <label>
                    Texte de l’offre
                    <textarea
                      name="description"
                      rows={9}
                      placeholder="Missions, profil recherché, équipe…"
                    />
                  </label>
                  <button className="primary" disabled={!!busy}>
                    <Plus size={16} />
                    {busy ? "Analyse en cours…" : "Créer le dossier"}
                  </button>
                </form>
              </>
            )}
            {modal === "document" && document && (
              <>
                <div className="eyebrow">
                  {document.type} · VERSION {document.version}
                </div>
                <h2>{document.filename}</h2>
                <p className="small muted">{document.quality}</p>
                <textarea
                  className="doc-editor"
                  aria-label="Texte du document"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <div className="flex wrap">
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(editText);
                      setNotice("Texte copié.");
                    }}
                  >
                    <Copy size={16} />
                    Copier
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={async () => {
                      const r = await act("save-document", {
                        id: document.id,
                        text: editText,
                      });
                      if (r) {
                        setDocument(r);
                        setNotice("Nouvelle version enregistrée.");
                      }
                    }}
                  >
                    Enregistrer une nouvelle version
                  </button>
                  {!demo && (
                    <>
                      <a
                        className="button"
                        href={"/api/document/" + document.id + "?format=pdf"}
                      >
                        <Download size={16} />
                        PDF A4
                      </a>
                      <a
                        className="button"
                        href={"/api/document/" + document.id + "?format=docx"}
                      >
                        DOCX
                      </a>
                      <button
                        disabled={!!busy}
                        onClick={() =>
                          act("export", { id: document.id, format: "pdf" })
                        }
                      >
                        Enregistrer PDF dans Drive
                      </button>
                    </>
                  )}
                  {["Email", "Relance", "Remerciement"].includes(
                    document.type,
                  ) && (
                    <button
                      className="primary"
                      onClick={() => setModal("draft")}
                    >
                      <Mail size={16} />
                      Créer le brouillon Gmail
                    </button>
                  )}
                </div>
                <p className="small muted">
                  Les exports utilisent la version enregistrée. Une version
                  utilisée pour candidater reste conservée.
                </p>
              </>
            )}
            {modal === "contact" && (
              <>
                <h2>Ajouter un contact sourcé</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const c = {
                      applicationId: app?.id || "",
                      company: String(f.get("company")),
                      name: String(f.get("name")),
                      role: String(f.get("role")),
                      type: "Contact manuel",
                      email: String(f.get("email")),
                      emailStatus: String(f.get("emailStatus")),
                      linkedin: String(f.get("linkedin")),
                      source: String(f.get("source")),
                      alumniSkema: f.get("alumni") === "on",
                      relevance: String(f.get("relevance")),
                      primary: !appContacts.length,
                    };
                    const r = await act("contact", { contact: c });
                    if (r) setModal("");
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Nom
                      <input required name="name" />
                    </label>
                    <label>
                      Société
                      <input
                        required
                        name="company"
                        defaultValue={app?.company}
                      />
                    </label>
                    <label>
                      Fonction
                      <input name="role" />
                    </label>
                    <label>
                      Email
                      <input name="email" type="email" />
                    </label>
                  </div>
                  <label>
                    Qualité de l’email
                    <select name="emailStatus">
                      <option value="NOT_FOUND">Non trouvé</option>
                      <option value="PROBABLE_PATTERN">
                        Probable, non vérifié
                      </option>
                      <option value="VERIFIED_PUBLIC">
                        Public vérifié par moi
                      </option>
                    </select>
                  </label>
                  <label>
                    URL de la source publique
                    <input name="source" type="url" />
                  </label>
                  <label>
                    LinkedIn
                    <input name="linkedin" type="url" />
                  </label>
                  <label>
                    Pourquoi le contacter
                    <textarea name="relevance" />
                  </label>
                  <label className="check">
                    <input name="alumni" type="checkbox" />
                    Alumni SKEMA confirmé
                  </label>
                  <button disabled={!!busy} className="primary">
                    Enregistrer
                  </button>
                </form>
              </>
            )}
            {modal === "sent" && app && (
              <>
                <h2>Confirmer votre candidature</h2>
                <p>
                  Cette action enregistre votre déclaration de dépôt. Elle ne
                  soumet aucun formulaire et n’envoie aucun email.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const r = await act("sent", {
                      id: app.id,
                      documentIds: f.getAll("documents"),
                    });
                    if (r) setModal("");
                  }}
                >
                  <h3>Versions réellement utilisées</h3>
                  {data.documents
                    .filter(
                      (d) => d.applicationId === app.id || d.type === "CV",
                    )
                    .map((d) => (
                      <label className="check" key={d.id}>
                        <input type="checkbox" name="documents" value={d.id} />
                        {d.filename} · v{d.version}
                      </label>
                    ))}
                  <label className="check">
                    <input type="checkbox" required />
                    J’ai effectivement déposé cette candidature.
                  </label>
                  <button className="primary" disabled={!!busy}>
                    Confirmer le dépôt
                  </button>
                </form>
              </>
            )}
            {modal === "draft" && document && app && (
              <>
                <h2>Préparer le brouillon Gmail</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const r = await act("draft", {
                      id: app.id,
                      documentId: document.id,
                      contactId: f.get("contact"),
                      attachmentIds: f.getAll("attachments"),
                    });
                    if (r) setModal("");
                  }}
                >
                  <label>
                    Destinataire
                    <select name="contact" required>
                      <option value="">Choisir une adresse vérifiée</option>
                      {appContacts
                        .filter((c) => c.emailStatus === "VERIFIED_PUBLIC")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} · {c.email}
                          </option>
                        ))}
                    </select>
                  </label>
                  <h3>Pièces jointes</h3>
                  {data.documents
                    .filter(
                      (d) =>
                        d.type === "CV" ||
                        (d.applicationId === app.id && d.type === "LM"),
                    )
                    .map((d) => (
                      <label className="check" key={d.id}>
                        <input
                          type="checkbox"
                          name="attachments"
                          value={d.id}
                        />
                        {d.filename}
                      </label>
                    ))}
                  <p>
                    Le brouillon restera dans Gmail pour relecture et envoi par
                    vous.
                  </p>
                  <button className="primary" disabled={!!busy}>
                    Créer le brouillon
                  </button>
                </form>
              </>
            )}
            {modal === "form" && app && (
              <>
                <h2>Répondre au formulaire</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const r = await act("write", {
                      id: app.id,
                      kind: "Formulaire",
                      question: f.get("question"),
                      limit: Number(f.get("limit")),
                    });
                    if (r) {
                      setDocument(r);
                      setEditText(r.text);
                      setModal("document");
                    }
                  }}
                >
                  <label>
                    Question
                    <textarea name="question" required rows={5} />
                  </label>
                  <label>
                    Limite de caractères
                    <input
                      name="limit"
                      type="number"
                      min="50"
                      max="10000"
                      defaultValue="1000"
                    />
                  </label>
                  <button disabled={!!busy} className="primary">
                    Préparer la réponse
                  </button>
                </form>
              </>
            )}
            {modal === "import" && (
              <>
                <h2>Importer un tracker</h2>
                <p>
                  CSV UTF-8, avec colonnes company, jobTitle, description et
                  officialUrl. Exportez votre Google Sheet ou Notion en CSV.
                  Chaque ligne sera analysée et dédupliquée.
                </p>
                <input
                  aria-label="Importer CSV"
                  type="file"
                  accept=".csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const { parseCsv } = await import("@/lib/client-utils");
                      const rows = parseCsv(await file.text());
                      let count = 0;
                      for (const r of rows.slice(0, 25)) {
                        const result = await act("add", {
                          url: r.officialUrl || "",
                          description:
                            r.description || `${r.company}\n${r.jobTitle}`,
                        });
                        if (!result) break;
                        count++;
                      }
                      setNotice(
                        `${count} offres importées. Limite de 25 par fichier.`,
                      );
                      setModal("");
                    } catch {
                      setError("CSV invalide.");
                    }
                  }}
                />
              </>
            )}
            {modal === "mail-import" && (
              <>
                <h2>Candidatures à confirmer</h2>
                <p>
                  Aucun dossier n’est créé automatiquement. Sélectionnez un
                  échange pertinent puis vérifiez son contenu.
                </p>
                {mailCandidates.map((m) => (
                  <div className="mail-row" key={m.id}>
                    <div>
                      <strong>{m.subject}</strong>
                      <p>
                        {m.from} · {date(m.date)}
                      </p>
                      <p>{m.text.slice(0, 350)}</p>
                      <button
                        disabled={!!busy}
                        onClick={async () => {
                          const r = await act("add", {
                            description: m.subject + "\n" + m.text,
                          });
                          if (r) {
                            setModal("");
                            open(r.id);
                            setNotice(
                              "Dossier importé à vérifier. Statut réel à confirmer dans Gmail.",
                            );
                          }
                        }}
                      >
                        Créer un dossier à vérifier
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
