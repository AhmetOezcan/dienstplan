import { useEffect, useRef, useState } from 'react'
import './LandingPage.css'

const OrdoLogo = ({ size = 28 }) => (
  <img src="/logo_oc.png" alt="Ordo Cloud" style={{ width: size, height: size, objectFit: 'contain' }} />
)

const DEMO_ROWS = [
  { name: 'Müller A.', cells: [
    { cls: 'c-violet', label: 'Residenz Nord', idx: 0 },
    { cls: 'c-violet', label: 'Residenz Nord', idx: 1 },
    { cls: 'c-blue',   label: 'Haus am Park',  idx: 2 },
    { cls: 'c-violet', label: 'Residenz Nord', idx: 3 },
    { cls: 'c-blue',   label: 'Haus am Park',  idx: 4 },
  ]},
  { name: 'Schmidt K.', cells: [
    { cls: 'c-cyan',  label: 'Betreutes W.',  idx: 5 },
    null,
    { cls: 'c-cyan',  label: 'Betreutes W.',  idx: 6 },
    { cls: 'c-green', label: 'Sonnenhof',     idx: 7 },
    { cls: 'c-cyan',  label: 'Betreutes W.',  idx: 8 },
  ]},
  { name: 'Wagner L.', cells: [
    { cls: 'c-orange', label: 'Pflegezentr.', idx: 9 },
    { cls: 'c-orange', label: 'Pflegezentr.', idx: 10 },
    { cls: 'c-pink',   label: 'Klinik West',  idx: 11 },
    { cls: 'c-orange', label: 'Pflegezentr.', idx: 12 },
    { cls: 'c-teal',   label: 'AWO Heim',     idx: 13 },
  ]},
  { name: 'Bauer S.', cells: [
    null,
    { cls: 'c-green', label: 'Sonnenhof',    idx: 14 },
    { cls: 'c-green', label: 'Sonnenhof',    idx: 15 },
    { cls: 'c-pink',  label: 'Klinik West',  idx: 16 },
    null,
  ]},
]
const TOTAL_BLOCKS = 17

export default function LandingPage({ onLogin }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(0)
  const [isResetting, setIsResetting] = useState(false)
  const cardContainerRef = useRef(null)

  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => { document.documentElement.style.scrollBehavior = prev }
  }, [])

  useEffect(() => {
    let timer
    if (isResetting) {
      timer = setTimeout(() => { setIsResetting(false); setVisibleCount(0) }, 600)
    } else if (visibleCount < TOTAL_BLOCKS) {
      timer = setTimeout(() => setVisibleCount((v) => v + 1), 130)
    } else {
      timer = setTimeout(() => setIsResetting(true), 2000)
    }
    return () => clearTimeout(timer)
  }, [visibleCount, isResetting])

  useEffect(() => {
    if (!cardContainerRef.current) return
    const cards = cardContainerRef.current.querySelectorAll(
      '.lp-feature-card, .lp-step-card, .lp-testimonial-card',
    )
    cards.forEach((el) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(20px)'
      el.style.transition = 'opacity .55s ease, transform .55s ease, box-shadow .18s ease, border-color .18s ease'
    })
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.opacity = '1'
            e.target.style.transform = 'translateY(0)'
          }
        })
      },
      { threshold: 0.1 },
    )
    cards.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id) => {
    setMobileNavOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing-page" ref={cardContainerRef}>

      {/* NAV */}
      <nav className="lp-nav">
        <button className="lp-nav-logo" onClick={() => scrollTo('lp-hero')} type="button">
          <OrdoLogo size={28} />
          Ordo Cloud
        </button>

        <ul className="lp-nav-links">
          <li><a href="#lp-funktionen" onClick={(e) => { e.preventDefault(); scrollTo('lp-funktionen') }}>Funktionen</a></li>
          <li><a href="#lp-ablauf" onClick={(e) => { e.preventDefault(); scrollTo('lp-ablauf') }}>So funktioniert's</a></li>
          <li><a href="#lp-kontakt" onClick={(e) => { e.preventDefault(); scrollTo('lp-kontakt') }}>Kontakt</a></li>
          <li>
            <button className="lp-nav-cta" onClick={onLogin} type="button">Anmelden</button>
          </li>
        </ul>

        <button
          className="lp-nav-hamburger"
          aria-label="Menü öffnen"
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
        >
          <span /><span /><span />
        </button>
      </nav>

      {mobileNavOpen && (
        <ul className="lp-mobile-nav">
          <li><a href="#lp-funktionen" onClick={(e) => { e.preventDefault(); scrollTo('lp-funktionen') }}>Funktionen</a></li>
          <li><a href="#lp-ablauf" onClick={(e) => { e.preventDefault(); scrollTo('lp-ablauf') }}>So funktioniert's</a></li>
          <li><a href="#lp-kontakt" onClick={(e) => { e.preventDefault(); scrollTo('lp-kontakt') }}>Kontakt</a></li>
          <li><button onClick={onLogin} type="button">Anmelden</button></li>
        </ul>
      )}

      {/* HERO */}
      <section className="lp-hero" id="lp-hero">
        <div className="lp-hero-orbs">
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
          <div className="lp-orb lp-orb-3" />
        </div>

        <div style={{ width: '100%', maxWidth: 960, position: 'relative', zIndex: 1 }}>
          <div className="lp-hero-content lp-fade-up lp-fade-up-1">
            <div className="lp-hero-badge">
              <span className="lp-hero-badge-dot" />
              Dienstplanung neu gedacht
            </div>

            <h1>
              Smart und fehlerfrei planen.<br />
              <span>Ein Dashboard - das ganze Unternehmen im Überblick.</span>
            </h1>

            <p className="lp-hero-sub">
              Ordo Cloud ist die moderne Dienstplansoftware für Pflegeeinrichtungen, Reinigungsdienste und Servicebetriebe. Schichten per Drag-and-Drop planen, Mitarbeiter verwalten und Feedback sammeln – alles in einer Lösung.
            </p>

            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={() => scrollTo('lp-kontakt')} type="button">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                Jetzt anfragen
              </button>
              <button className="lp-btn-ghost" onClick={onLogin} type="button">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
                Zur App anmelden
              </button>
            </div>
          </div>

          {/* Demo Mockup */}
          <div className="lp-float lp-fade-up lp-fade-up-3" style={{ marginTop: '4rem' }}>
            <div className="lp-demo-shell">
              <div className="lp-demo-topbar">
                <div className="lp-demo-dot lp-demo-dot-r" />
                <div className="lp-demo-dot lp-demo-dot-y" />
                <div className="lp-demo-dot lp-demo-dot-g" />
                <span className="lp-demo-topbar-title">Ordo Cloud – KW 17 · Dienstplan</span>
              </div>
              <div className="lp-demo-body">
                <div className="lp-demo-sidebar">
                  <div className="lp-demo-nav-item active">Dienstplan</div>
                  <div className="lp-demo-nav-item">Mitarbeiter</div>
                  <div className="lp-demo-nav-item">Kunden</div>
                  <div className="lp-demo-nav-item">Feedback</div>
                </div>
                <div className="lp-demo-main">
                  <div className="lp-demo-week-row">
                    <span className="lp-demo-wk-lbl" style={{ fontSize: '.65rem', color: 'rgba(255,255,255,.3)' }} />
                    {['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((d) => (
                      <span key={d} className="lp-demo-wk-lbl">{d}</span>
                    ))}
                  </div>
                  {DEMO_ROWS.map((row) => (
                    <div className="lp-demo-week-row" key={row.name}>
                      <span className="lp-demo-wk-lbl">{row.name}</span>
                      {row.cells.map((cell, i) => {
                        if (!cell) return <div key={i} className="lp-demo-block lp-demo-empty" />
                        const visible = visibleCount > cell.idx
                        const fading  = isResetting && visible
                        return (
                          <div
                            key={i}
                            className={`lp-demo-block lp-${cell.cls} ${fading ? 'lp-block-out' : visible ? 'lp-block-in' : 'lp-block-hidden'}`}
                          >
                            {visible ? cell.label : ''}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* FEATURES */}
      <section className="lp-section lp-features-bg" id="lp-funktionen">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <span className="lp-section-label">Alles drin</span>
            <h2 className="lp-section-title">Alles, was Sie für Ihren Betrieb brauchen</h2>
            <p className="lp-section-desc">Von der Wochenplanung bis zum Mitarbeiterfeedback – Ordo Cloud deckt jeden Schritt des Dienstplanprozesses ab.</p>
          </div>
          <div className="lp-features-grid">
            {[
              {
                color: 'purple', stroke: '#7c3aed',
                title: 'Drag-and-Drop Dienstplan',
                desc: 'Verschieben Sie Schichten einfach per Maus auf der interaktiven Wochenzeitleiste. Mit 30-Minuten-Intervallen und automatischer Konflikterkennung für lückenlose Planung.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
              },
              {
                color: 'blue', stroke: '#2563eb',
                title: 'Tag- & Nachtschichten',
                desc: 'Planen Sie sowohl Tagdienste (07:00–18:00) als auch Nachtdienste in getrennten, übersichtlichen Ansichten. Ideal für Pflegebetriebe mit Rund-um-die-Uhr-Betrieb.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
              },
              {
                color: 'cyan', stroke: '#0891b2',
                title: 'Mitarbeiterverwaltung',
                desc: 'Legen Sie Mitarbeiterprofile mit Kontaktdaten und Notizen an. Verknüpfen Sie Mitarbeiter mit Benutzerkonten und behalten Sie Arbeitsstunden auf einen Blick im Überblick.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              },
              {
                color: 'green', stroke: '#16a34a',
                title: 'Kundenverwaltung',
                desc: 'Verwalten Sie alle Kundenstammdaten zentral. Weisen Sie jedem Kunden eine individuelle Farbe zu – so erkennen Sie Zuordnungen im Dienstplan auf Anhieb.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
              },
              {
                color: 'orange', stroke: '#ea580c',
                title: 'Druckfertiger Export',
                desc: 'Drucken Sie den Wochenplan mit einem Klick im optimierten Querformat aus – für die Pinnwand im Pausenraum oder den Aktenordner.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
              },
              {
                color: 'pink', stroke: '#db2777',
                title: 'QR-Feedback System',
                desc: 'Erstellen Sie öffentliche Feedback-Seiten mit QR-Code. Mitarbeiter und Kunden geben unkompliziert Rückmeldungen – ganz ohne Login.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h.01M18 14h.01M14 18h.01M18 18h.01"/></svg>,
              },
              {
                color: 'purple', stroke: '#7c3aed',
                title: 'Multi-Mandanten & Rollen',
                desc: 'Verwalten Sie mehrere Betriebsstandorte in einem Konto. Daten sind vollständig mandantengetrennt. Einladungen erfolgen per sicherem Einladungscode.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              },
              {
                color: 'blue', stroke: '#2563eb',
                title: 'Wochenkopie',
                desc: 'Wiederkehrende Pläne müssen nicht jede Woche neu erstellt werden. Kopieren Sie eine komplette Planungswoche auf Knopfdruck und passen Sie Abweichungen an.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
              },
              {
                color: 'cyan', stroke: '#0891b2',
                title: 'Responsive auf jedem Gerät',
                desc: 'Ob Desktop, Tablet oder Smartphone – Ordo Cloud passt sich automatisch an die Bildschirmgröße an. Keine App-Installation erforderlich.',
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>,
              },
            ].map((f) => (
              <div className="lp-feature-card" key={f.title}>
                <div className={`lp-feature-icon lp-icon-${f.color}`}>{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-section lp-howitworks-bg" id="lp-ablauf">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <span className="lp-section-label">Schnell starten</span>
            <h2 className="lp-section-title">In drei Schritten zum fertigen Dienstplan</h2>
            <p className="lp-section-desc">Ordo Cloud ist so einfach, dass Sie bereits am ersten Tag produktiv sind – ohne Schulung oder IT-Abteilung.</p>
          </div>
          <div className="lp-steps-grid">
            <div className="lp-step-card">
              <div className="lp-step-number">1</div>
              <h3>Kontakt aufnehmen</h3>
              <p>Schreiben Sie uns eine kurze Nachricht. Wir richten Ihr Konto persönlich ein und begleiten Sie beim Start – ohne komplizierte Selbstregistrierung.</p>
            </div>
            <div className="lp-step-card">
              <div className="lp-step-number">2</div>
              <h3>Team & Kunden pflegen</h3>
              <p>Tragen Sie Ihre Mitarbeiter und Kundenstandorte ein. Weisen Sie jedem Kunden eine Farbe zu – so bleibt die Übersicht stets erhalten.</p>
            </div>
            <div className="lp-step-card">
              <div className="lp-step-number">3</div>
              <h3>Schichten planen</h3>
              <p>Öffnen Sie die Wochenansicht und ziehen Sie Schichten per Drag-and-Drop an die richtige Stelle. Konflikte werden sofort angezeigt. Fertig – Plan drucken oder teilen.</p>
            </div>
          </div>

          {/* Workflow table */}
          <div className="lp-workflow-visual">
            <p className="lp-workflow-label">Beispiel: KW 17 – Tagdienst</p>
            <div className="lp-workflow-week">
              <div className="lp-wk-header" />
              {['Mo 21.04','Di 22.04','Mi 23.04','Do 24.04','Fr 25.04','Sa 26.04','So 27.04'].map((d) => (
                <div className="lp-wk-header" key={d}>{d}</div>
              ))}

              <div className="lp-wk-row-label">Anna M.</div>
              <div className="lp-shift-block" style={{ background: '#7c3aed' }}>Residenz Nord<br /><span style={{ fontWeight: 400, fontSize: '.67rem', opacity: .85 }}>08:00–16:00</span></div>
              <div className="lp-shift-block" style={{ background: '#7c3aed' }}>Residenz Nord</div>
              <div className="lp-wk-cell" />
              <div className="lp-shift-block" style={{ background: '#2563eb' }}>Haus am Park</div>
              <div className="lp-shift-block" style={{ background: '#7c3aed' }}>Residenz Nord</div>
              <div className="lp-wk-cell" /><div className="lp-wk-cell" />

              <div className="lp-wk-row-label">Klaus S.</div>
              <div className="lp-wk-cell" />
              <div className="lp-shift-block" style={{ background: '#0891b2' }}>Betreutes Wohnen</div>
              <div className="lp-shift-block" style={{ background: '#0891b2' }}>Betreutes Wohnen</div>
              <div className="lp-shift-block" style={{ background: '#16a34a' }}>Sonnenhof</div>
              <div className="lp-wk-cell" />
              <div className="lp-shift-block" style={{ background: '#0891b2' }}>Betreutes Wohnen</div>
              <div className="lp-wk-cell" />

              <div className="lp-wk-row-label">Lisa W.</div>
              <div className="lp-shift-block" style={{ background: '#ea580c' }}>Pflegezentrum</div>
              <div className="lp-wk-cell" />
              <div className="lp-shift-block" style={{ background: '#ea580c' }}>Pflegezentrum</div>
              <div className="lp-shift-block" style={{ background: '#ea580c' }}>Pflegezentrum</div>
              <div className="lp-shift-block" style={{ background: '#db2777' }}>Klinik West</div>
              <div className="lp-wk-cell" /><div className="lp-wk-cell" />
            </div>
          </div>
        </div>
      </section>


      {/* CONTACT / CTA */}
      <section className="lp-cta-section" id="lp-kontakt">
        <div className="lp-hero-orbs">
          <div className="lp-orb lp-orb-1" style={{ opacity: .4 }} />
          <div className="lp-orb lp-orb-2" style={{ opacity: .4 }} />
        </div>
        <div className="lp-cta-content">
          <h2>Interesse geweckt?<br />Melden Sie sich bei uns.</h2>
          <p>Wir richten Ihren Zugang persönlich ein und begleiten Sie beim Start. Schreiben Sie uns einfach eine E-Mail – wir melden uns schnellstmöglich.</p>
          <div className="lp-hero-actions" style={{ justifyContent: 'center' }}>
            <a
              href="mailto:ahmetzcan1@outlook.com?subject=Anfrage%20Ordo%20Cloud&body=Guten%20Tag%2C%0A%0Aich%20interessiere%20mich%20f%C3%BCr%20Ordo%20Cloud%20und%20w%C3%BCrde%20gerne%20mehr%20erfahren.%0A%0AMit%20freundlichen%20Gr%C3%BC%C3%9Fen"
              className="lp-btn-primary"
              style={{ fontSize: '1.05rem', padding: '1rem 2.5rem' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              Jetzt Kontakt aufnehmen
            </a>
          </div>
          <p className="lp-cta-login-hint">
            Bereits registriert?{' '}
            <button onClick={onLogin} type="button">Hier anmelden</button>
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <div className="lp-footer-logo-row">
                <OrdoLogo size={22} />
                Ordo Cloud
              </div>
              <p>Professionelle Dienstplansoftware für Pflegebetriebe, Reinigungsdienste und Serviceteams im deutschsprachigen Raum.</p>
            </div>

            <div className="lp-footer-col">
              <h4>Produkt</h4>
              <ul>
                <li><a href="#lp-funktionen" onClick={(e) => { e.preventDefault(); scrollTo('lp-funktionen') }}>Funktionen</a></li>
                <li><a href="#lp-ablauf" onClick={(e) => { e.preventDefault(); scrollTo('lp-ablauf') }}>So funktioniert's</a></li>
                <li><a href="#lp-kontakt" onClick={(e) => { e.preventDefault(); scrollTo('lp-kontakt') }}>Kontakt</a></li>
                <li><button onClick={onLogin} type="button">Anmelden</button></li>
              </ul>
            </div>

            <div className="lp-footer-col">
              <h4>Branchen</h4>
              <ul>
                <li><a href="#lp-funktionen" onClick={(e) => { e.preventDefault(); scrollTo('lp-funktionen') }}>Pflege &amp; Gesundheit</a></li>
                <li><a href="#lp-funktionen" onClick={(e) => { e.preventDefault(); scrollTo('lp-funktionen') }}>Gebäudereinigung</a></li>
                <li><a href="#lp-funktionen" onClick={(e) => { e.preventDefault(); scrollTo('lp-funktionen') }}>Gastronomie</a></li>
                <li><a href="#lp-funktionen" onClick={(e) => { e.preventDefault(); scrollTo('lp-funktionen') }}>Sicherheitsdienste</a></li>
              </ul>
            </div>

            <div className="lp-footer-col">
              <h4>Rechtliches</h4>
              <ul>
                <li><a href="/#legal-imprint">Impressum</a></li>
                <li><a href="/#legal-privacy">Datenschutz</a></li>
                <li><a href="/#legal-cookies">Cookies</a></li>
              </ul>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <span>© 2026 Ordo Cloud. Alle Rechte vorbehalten.</span>
            <span>Made with ♥ in Österreich</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
