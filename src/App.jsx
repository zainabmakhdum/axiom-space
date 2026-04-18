import { useState, useEffect } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { jsPDF } from 'jspdf'
import { retrieveRelevantContext, formatContextForPrompt, getEntryById } from './utils/retrieval'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

function parseJSON(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleaned)
}

const TIER_COLORS = {
  Safety: {
    border: '#EF5350',
    bg: 'rgba(239,83,80,0.07)',
    badge: { color: '#EF5350', background: 'rgba(239,83,80,0.14)', borderColor: 'rgba(239,83,80,0.35)' },
  },
  Power: {
    border: '#FFB300',
    bg: 'rgba(255,179,0,0.07)',
    badge: { color: '#FFB300', background: 'rgba(255,179,0,0.14)', borderColor: 'rgba(255,179,0,0.35)' },
  },
  Science: {
    border: '#4FC3F7',
    bg: 'rgba(79,195,247,0.07)',
    badge: { color: '#4FC3F7', background: 'rgba(79,195,247,0.14)', borderColor: 'rgba(79,195,247,0.35)' },
  },
  Ops: {
    border: '#78909C',
    bg: 'rgba(120,144,156,0.07)',
    badge: { color: '#78909C', background: 'rgba(120,144,156,0.14)', borderColor: 'rgba(120,144,156,0.35)' },
  },
}

const OUTCOME_COLORS = {
  pass: {
    border: '#4CAF50',
    bg: 'rgba(76,175,80,0.07)',
    badge: { color: '#4CAF50', background: 'rgba(76,175,80,0.14)', borderColor: 'rgba(76,175,80,0.35)' },
  },
  conflict: {
    border: '#FFB300',
    bg: 'rgba(255,179,0,0.07)',
    badge: { color: '#FFB300', background: 'rgba(255,179,0,0.14)', borderColor: 'rgba(255,179,0,0.35)' },
  },
  gap: {
    border: '#EF5350',
    bg: 'rgba(239,83,80,0.07)',
    badge: { color: '#EF5350', background: 'rgba(239,83,80,0.14)', borderColor: 'rgba(239,83,80,0.35)' },
  },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const DRAWER_SOURCES = [
  { id: 'CSLI', badge: 'NASA', title: 'CubeSat Launch Initiative', desc: 'NASA CSLI program documentation + CubeSat 101 guide', url: 'https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/' },
  { id: 'ESA-DEBRIS', badge: 'ESA', title: 'Space Debris Environment Report', desc: 'ESA Space Debris Office annual reports', url: 'https://www.esa.int/Space_Safety/Space_Debris' },
  { id: 'GSFC', badge: 'NASA', title: 'NASA Goddard Anomaly Reports', desc: 'GSFC small satellite mission lessons learned', url: 'https://www.nasa.gov/smallsat-institute/' },
  { id: 'ARTEMIS', badge: 'NASA', title: 'Artemis Lunar CubeSats', desc: 'Lunar IceCube and LunaH-Map Artemis-1 rideshare profiles', url: 'https://www.nasa.gov/kennedy/launch-services-program/cubesat-launch-initiative/' },
]

function Drawer({ open, onClose }) {
  const [tab, setTab] = useState('about')

  return (
    <>
      {open && <div className="axiom-drawer-overlay" onClick={onClose} />}
      <div className={`axiom-drawer${open ? ' open' : ''}`}>
        <div className="axiom-drawer-header">
          <span className="axiom-drawer-title">AXIOM</span>
          <button className="axiom-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="axiom-drawer-tabs">
          {[
            { key: 'about', label: 'About' },
            { key: 'solution', label: 'The Solution' },
            { key: 'demo', label: 'Demo' },
            { key: 'sources', label: 'Data Sources' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`axiom-drawer-tab${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="axiom-drawer-content">
          {tab === 'about' && (
            <div className="axiom-drawer-section">
              <h3>What is AXIOM?</h3>
              <p>AXIOM (Autonomous eXploration Intent &amp; Objective Manager) is a mission constraint governance system designed for the age of deep space autonomy.</p>
              <p>As spacecraft operate further from Earth — with light-speed delays making real-time control impossible — autonomous systems must make consequential decisions independently. AXIOM is the constitutional layer that defines the boundaries of that autonomy.</p>
              <h3>The Problem</h3>
              <p>Mission constraints written by humans are often ambiguous, conflicting, or incomplete. A constraint set that seems reasonable on paper may contain logical conflicts that only surface under specific operational conditions — precisely the conditions an autonomous spacecraft is likely to encounter.</p>
              <p>Traditional verification methods require domain experts, days of analysis, and often miss emergent failure modes that only arise when multiple constraints interact.</p>
            </div>
          )}
          {tab === 'solution' && (
            <div className="axiom-drawer-section">
              <h3>The Solution</h3>
              <p>AXIOM uses Constitutional AI techniques to stress-test mission constraint sets before deployment. An adversarial AI agent probes for:</p>
              <ul className="axiom-drawer-bullet-list">
                <li>Logical conflicts between constraints</li>
                <li>Coverage gaps in edge cases and boundary conditions</li>
                <li>Ambiguities that could be exploited or misinterpreted</li>
                <li>Scenarios technically compliant but intent-violating</li>
              </ul>
              <h3>RAG-Enhanced Analysis</h3>
              <p>AXIOM grounds its analysis in verified NASA and ESA mission data — real anomaly reports, debris statistics, and CubeSat operational profiles — injected as context during stress testing.</p>

              <h3>Constraint Refinement Loop</h3>
              <p>When gaps or conflicts are found, AXIOM suggests targeted constraint additions. Accepted fixes are added to the registry and can trigger a re-run, creating a closed refinement loop.</p>
            </div>
          )}
          {tab === 'demo' && (
            <div className="axiom-drawer-section">
              <p style={{ marginBottom: 10 }}>Demo recording coming soon.</p>
              <a href="#" className="axiom-drawer-demo-link">→ Watch Demo</a>
            </div>
          )}
          {tab === 'sources' && (
            <div className="axiom-drawer-section">
              <h3>Knowledge Base</h3>
              <p>AXIOM's RAG system retrieves from these verified sources during stress test analysis to ground scenarios in real mission history.</p>
              <div className="axiom-source-cards">
                {DRAWER_SOURCES.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="axiom-source-card"
                  >
                    <span className={`axiom-source-badge ${s.badge.toLowerCase()}`}>{s.badge}</span>
                    <div className="axiom-source-card-info">
                      <span className="axiom-source-card-title">{s.title}</span>
                      <span className="axiom-source-card-desc">{s.desc}</span>
                    </div>
                    <span className="axiom-source-card-arrow">→</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function NavBar({ stage, missionData, onHamburgerClick }) {
  return (
    <nav className="axiom-nav">
      <div className="axiom-nav-inner">
        <div className="axiom-nav-left">
          <button className="axiom-hamburger" onClick={onHamburgerClick} aria-label="Open menu">
            <span /><span /><span />
          </button>
          <span className="axiom-nav-dot" />
          <span className="axiom-logo">AXIOM</span>
        </div>
        <div className="axiom-nav-breadcrumb">
          {missionData && (
            <>
              <span className="axiom-breadcrumb-mission">{missionData.missionName}</span>
              <span className="axiom-breadcrumb-sep">/</span>
            </>
          )}
          <span>STAGE {stage} OF 3</span>
        </div>
        <div className="axiom-nav-stages">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`axiom-stage-dot ${stage > s ? 'complete' : stage === s ? 'active' : 'inactive'}`}
            />
          ))}
        </div>
      </div>
    </nav>
  )
}

function HeroSection() {
  return (
    <section className="axiom-hero">
      <div className="axiom-hero-stars" />
      <div
        className="axiom-hero-bg"
        style={{
          backgroundImage:
            'url(https://images-assets.nasa.gov/image/art002e009289/art002e009289~orig.jpg)',
        }}
      />
      <div className="axiom-hero-overlay" />
      <div className="axiom-hero-scanlines" />
      <div className="axiom-hero-content">
        <p className="axiom-hero-supertitle">
          ARTEMIS II · APRIL 6, 2026 · 248,655 MI FROM EARTH
        </p>
        <h1 className="axiom-hero-title">AXIOM</h1>
        <h2 className="axiom-hero-subtitle">
          Autonomous eXploration Intent &amp; Objective Manager
        </h2>
        <p className="axiom-hero-desc">
          The bottleneck isn't compute. It's trust. AXIOM is the governance layer between
          human intent and autonomous action — built for the age of deep space.
        </p>
        <div className="axiom-scroll-indicator">
          <span className="axiom-scroll-arrow">↓</span>
        </div>
      </div>
    </section>
  )
}

function StageTracker({ stage }) {
  const steps = [
    { num: '01', label: 'INITIALIZE' },
    { num: '02', label: 'CONSTRAINTS' },
    { num: '03', label: 'STRESS TEST' },
  ]
  return (
    <div className="axiom-stage-tracker">
      {steps.map((s, i) => {
        const stepNum = i + 1
        const state = stage > stepNum ? 'complete' : stage === stepNum ? 'active' : 'inactive'
        return (
          <div key={s.num} className={`axiom-step ${state}`}>
            <span className="axiom-step-num">{state === 'complete' ? '✓' : s.num}</span>
            <span className="axiom-step-label">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function SectionHeader({ title, sub }) {
  return (
    <div className="axiom-section-header">
      <h2 className="axiom-section-title">{title}</h2>
      {sub && <div className="axiom-section-sub">{sub}</div>}
    </div>
  )
}

function ErrorBox({ msg, onRetry }) {
  return (
    <div className="axiom-error">
      <span>⚠ {msg}</span>
      {onRetry && (
        <button onClick={onRetry} className="axiom-retry-btn">
          retry
        </button>
      )}
    </div>
  )
}

// ─── Stage 1: Mission Form ────────────────────────────────────────────────────

function Stage1({ onComplete }) {
  const [form, setForm] = useState({ missionName: '', missionType: 'Orbital Survey', objective: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content:
              `You are a mission planning AI. Return ONLY a valid JSON object — no markdown, no explanation, no extra text.\n\n` +
              `Mission Name: ${form.missionName}\n` +
              `Mission Type: ${form.missionType}\n` +
              `Primary Objective: ${form.objective}\n\n` +
              `Required JSON structure:\n` +
              `{"missionName":"...","missionType":"...","objective":"...","keyConstraints":["...","...","..."],"operationalEnvironment":"..."}`,
          },
        ],
      })
      setResult(parseJSON(res.content[0].text))
    } catch (err) {
      setError(err.message || 'Failed to initialize mission')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="axiom-stage">
      <SectionHeader title="Mission Initialization" />

      {!result ? (
        <form onSubmit={handleSubmit} className="axiom-form">
          <div className="axiom-field">
            <label className="axiom-label">Mission Designation</label>
            <input
              type="text"
              value={form.missionName}
              onChange={set('missionName')}
              required
              placeholder="e.g. NEXUS-7"
              className="axiom-input"
            />
          </div>

          <div className="axiom-field">
            <label className="axiom-label">Mission Classification</label>
            <select
              value={form.missionType}
              onChange={set('missionType')}
              className="axiom-input axiom-select"
            >
              <option>Orbital Survey</option>
              <option>Surface Rover</option>
              <option>Comms Relay</option>
            </select>
          </div>

          <div className="axiom-field">
            <label className="axiom-label">Primary Objective</label>
            <textarea
              value={form.objective}
              onChange={set('objective')}
              required
              rows={4}
              placeholder="Define the primary mission objective in detail..."
              className="axiom-input axiom-textarea"
            />
          </div>

          {error && <ErrorBox msg={error} />}

          <button type="submit" disabled={loading} className="axiom-btn-primary">
            {loading ? (
              <>
                <span className="axiom-spinner" />
                INITIALIZING...
              </>
            ) : (
              'INITIALIZE MISSION'
            )}
          </button>
          {loading && <div className="axiom-scan-line-input" />}
        </form>
      ) : (
        <div className="axiom-result-block">
          <div className="axiom-mission-card">
            <div className="axiom-mission-card-grid" />
            <div className="axiom-mission-header">
              <span className="axiom-mission-name">{result.missionName}</span>
              <span className="axiom-mission-type-badge">{result.missionType}</span>
            </div>
            <div className="axiom-mission-row">
              <div className="axiom-mission-row-label">Objective</div>
              <div className="axiom-mission-row-value">{result.objective}</div>
            </div>
            <div className="axiom-mission-row">
              <div className="axiom-mission-row-label">Key Constraints</div>
              <div className="axiom-constraint-items">
                {result.keyConstraints.map((c, i) => (
                  <div key={i} className="axiom-constraint-item">
                    <span className="axiom-constraint-bullet">▸</span>
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="axiom-mission-row">
              <div className="axiom-mission-row-label">Operational Environment</div>
              <div className="axiom-mission-row-value">{result.operationalEnvironment}</div>
            </div>
          </div>
          <button onClick={() => onComplete(result)} className="axiom-btn-primary">
            PROCEED TO CONSTRAINTS →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Stage 2: Constraint Authoring ───────────────────────────────────────────

function Stage2({ missionData, onComplete }) {
  const [text, setText] = useState('')
  const [constraints, setConstraints] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!text.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content:
              `You are a mission constraint analyzer. Return ONLY a valid JSON object — no markdown, no explanation.\n\n` +
              `Mission: ${missionData.missionName} (${missionData.missionType})\n` +
              `Objective: ${missionData.objective}\n` +
              `Environment: ${missionData.operationalEnvironment}\n\n` +
              `New Constraint: "${text}"\n\n` +
              `Required JSON structure:\n` +
              `{"parsedConstraint":"...","ambiguityFlags":["..."],"priorityTier":"Safety","rationale":"..."}\n\n` +
              `priorityTier MUST be exactly one of: Safety, Power, Science, Ops`,
          },
        ],
      })
      const parsed = parseJSON(res.content[0].text)
      setConstraints((prev) => [
        ...prev,
        { ...parsed, id: `C-${String(prev.length + 1).padStart(2, '0')}` },
      ])
      setText('')
    } catch (err) {
      setError(err.message || 'Failed to analyze constraint')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="axiom-stage">
      <SectionHeader
        title="Constraint Authoring"
        sub={`${missionData.missionName} / ${missionData.missionType}`}
      />

      <div className="axiom-input-row">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          disabled={loading}
          placeholder="Enter operational constraint in natural language..."
          className="axiom-input axiom-input-flex"
        />
        <button
          onClick={handleAdd}
          disabled={loading || !text.trim()}
          className="axiom-btn-add"
        >
          {loading ? <><span className="axiom-spinner" /> PARSING...</> : 'ADD'}
        </button>
      </div>

      {error && (
        <div className="axiom-error-wrap">
          <ErrorBox msg={error} />
        </div>
      )}

      {constraints.length > 0 && (
        <div className="axiom-constraints-list">
          <div className="axiom-registry-header">
            CONSTRAINT REGISTRY — {constraints.length} LOADED
          </div>
          {constraints.map((c, idx) => {
            const colors = TIER_COLORS[c.priorityTier] || TIER_COLORS.Ops
            return (
              <div
                key={c.id}
                className="axiom-constraint-card"
                style={{
                  '--tier-color': colors.border,
                  '--tier-bg': colors.bg,
                  animationDelay: `${idx * 0.08}s`,
                }}
              >
                <div className="axiom-constraint-card-header">
                  <span className="axiom-tier-badge" style={colors.badge}>
                    ● {c.priorityTier}
                  </span>
                  <span className="axiom-constraint-id">{c.id}</span>
                </div>
                <div className="axiom-constraint-text">{c.parsedConstraint}</div>
                {c.ambiguityFlags?.length > 0 && (
                  <div className="axiom-ambiguity-flags">
                    {c.ambiguityFlags.map((f, i) => (
                      <span key={i} className="axiom-ambiguity-chip">
                        ⚠ {f}
                      </span>
                    ))}
                  </div>
                )}
                <div className="axiom-constraint-rationale">{c.rationale}</div>
              </div>
            )
          })}
        </div>
      )}

      {constraints.length < 2 && (
        <div className="axiom-hint">
          Add at least {2 - constraints.length} more constraint
          {constraints.length === 0 ? 's' : ''} to enable stress testing
        </div>
      )}

      {constraints.length >= 2 && (
        <button onClick={() => onComplete(constraints)} className="axiom-btn-stress">
          RUN STRESS TEST →
        </button>
      )}
    </div>
  )
}

// ─── Stage 3: Stress Test ─────────────────────────────────────────────────────

function Stage3({ missionData, constraints, onAddConstraint, initialScenarios, initialRetrievedSources }) {
  const [scenarios, setScenarios] = useState(initialScenarios || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [analysisVersion, setAnalysisVersion] = useState(1)
  const [fixStates, setFixStates] = useState({})
  const [anyFixAccepted, setAnyFixAccepted] = useState(false)
  const [toast, setToast] = useState(null)
  const [retrievedSources, setRetrievedSources] = useState(initialRetrievedSources || [])
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [citationOpen, setCitationOpen] = useState({})
  const [loadingStatus, setLoadingStatus] = useState('')

  useEffect(() => {
    if (!loading) return
    const msgs = [
      'Retrieving mission reference data...',
      'Probing constraint boundaries...',
      'Generating adversarial scenarios...',
    ]
    setLoadingStatus(msgs[0])
    const t1 = setTimeout(() => setLoadingStatus(msgs[1]), 2000)
    const t2 = setTimeout(() => setLoadingStatus(msgs[2]), 4000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [loading])

  const runTest = async (isRerun = false) => {
    if (isRerun) setAnalysisVersion((v) => v + 1)
    setLoading(true)
    setError('')
    setScenarios(null)
    setFixStates({})
    setCitationOpen({})
    try {
      const constraintList = constraints
        .map((c) => `${c.id} [${c.priorityTier}]: ${c.parsedConstraint}`)
        .join('\n')

      const retrievedEntries = retrieveRelevantContext(missionData, constraints)
      setRetrievedSources(retrievedEntries)
      const ragContext = formatContextForPrompt(retrievedEntries)

      const res = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        system:
          'You are an adversarial autonomous agent specialized in finding loopholes, conflicts, and gaps in spacecraft mission constraint sets. ' +
          'Your role is to identify scenarios where constraints fail, conflict with each other, or leave dangerous coverage gaps. ' +
          'Be specific, technically rigorous, and creative. Think like an attacker stress-testing the system.' +
          ragContext,
        messages: [
          {
            role: 'user',
            content:
              `Mission: ${missionData.missionName} (${missionData.missionType})\n` +
              `Objective: ${missionData.objective}\n` +
              `Environment: ${missionData.operationalEnvironment}\n\n` +
              `Constraints:\n${constraintList}\n\n` +
              `Return ONLY a JSON array of exactly 6 adversarial scenarios. No markdown, no explanation.\n\n` +
              `[{"scenario":"...","constraintsInvolved":["C-01"],"outcome":"pass","explanation":"...","citations":[]}]\n\n` +
              `outcome MUST be exactly one of: pass, conflict, gap\n` +
              `citations MUST be an array of reference IDs (e.g. ["GSFC-AN-001"]) from the REAL-WORLD REFERENCE DATA that directly informed this scenario, or an empty array if none apply`,
          },
        ],
      })
      setScenarios(parseJSON(res.content[0].text))
    } catch (err) {
      setError(err.message || 'Stress test failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFix = async (scenario, idx) => {
    setFixStates((prev) => ({ ...prev, [idx]: { loading: true, suggestion: null, error: null } }))
    try {
      const constraintList = constraints
        .map((c) => `${c.id} [${c.priorityTier}]: ${c.parsedConstraint}`)
        .join('\n')

      const res = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content:
            `You are a mission constraint engineer. A stress test identified a ${scenario.outcome} in the constraint set. Suggest a constraint to resolve it.\n\n` +
            `Mission: ${missionData.missionName} (${missionData.missionType})\n` +
            `Objective: ${missionData.objective}\n\n` +
            `Current constraints:\n${constraintList}\n\n` +
            `Failing scenario: "${scenario.scenario}"\n` +
            `Explanation: "${scenario.explanation}"\n\n` +
            `Return ONLY a valid JSON object — no markdown, no explanation:\n` +
            `{"suggestedConstraint":"...","reasoning":"...","affectedConstraints":["C-01"]}`,
        }],
      })
      const suggestion = parseJSON(res.content[0].text)
      setFixStates((prev) => ({ ...prev, [idx]: { loading: false, suggestion, error: null } }))
    } catch (err) {
      setFixStates((prev) => ({
        ...prev,
        [idx]: { loading: false, suggestion: null, error: err.message || 'Fix suggestion failed' },
      }))
    }
  }

  const handleAcceptFix = async (suggestion, idx) => {
    setFixStates((prev) => ({ ...prev, [idx]: { ...prev[idx], accepting: true } }))
    try {
      const res = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content:
            `You are a mission constraint analyzer. Return ONLY a valid JSON object — no markdown, no explanation.\n\n` +
            `Mission: ${missionData.missionName} (${missionData.missionType})\n` +
            `Objective: ${missionData.objective}\n` +
            `Environment: ${missionData.operationalEnvironment}\n\n` +
            `New Constraint: "${suggestion.suggestedConstraint}"\n\n` +
            `Required JSON structure:\n` +
            `{"parsedConstraint":"...","ambiguityFlags":["..."],"priorityTier":"Safety","rationale":"..."}\n\n` +
            `priorityTier MUST be exactly one of: Safety, Power, Science, Ops`,
        }],
      })
      const parsed = parseJSON(res.content[0].text)
      const newConstraint = {
        ...parsed,
        id: `C-${String(constraints.length + 1).padStart(2, '0')}`,
      }
      onAddConstraint(newConstraint)
      setAnyFixAccepted(true)
      setFixStates((prev) => ({
        ...prev,
        [idx]: { loading: false, accepting: false, accepted: true, suggestion: null },
      }))
      setToast('Constraint added to registry')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setFixStates((prev) => ({
        ...prev,
        [idx]: { ...prev[idx], accepting: false, error: err.message || 'Failed to process fix' },
      }))
    }
  }

  const handleDismiss = (idx) => {
    setFixStates((prev) => ({ ...prev, [idx]: { ...prev[idx], suggestion: null, error: null } }))
  }

  const handleShare = () => {
    const encoded = btoa(JSON.stringify({
      missionContext: missionData,
      constraints,
      stressTestResults: scenarios,
      retrievedSources,
    }))
    window.location.hash = `state=${encoded}`
    navigator.clipboard.writeText(window.location.href).then(
      () => { setToast('Link copied to clipboard'); setTimeout(() => setToast(null), 3000) },
      () => { setToast('Link ready — copy from address bar'); setTimeout(() => setToast(null), 4000) }
    )
  }

  const handleExport = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = 210
    const H = 297
    const ML = 20
    const CW = W - ML * 2

    const C_BG    = [1, 8, 20]
    const C_BLUE  = [79, 195, 247]
    const C_WHITE = [240, 248, 255]
    const C_DIM   = [144, 152, 161]
    const TIER_C  = { Safety: [239,83,80], Power: [255,179,0], Science: [79,195,247], Ops: [120,144,156] }
    const OUT_C   = { pass: [76,175,80], conflict: [255,179,0], gap: [239,83,80] }

    const bg = () => {
      doc.setFillColor(...C_BG)
      doc.rect(0, 0, W, H, 'F')
    }

    const hr = (y) => {
      doc.setDrawColor(...C_BLUE)
      doc.setLineWidth(0.25)
      doc.line(ML, y, W - ML, y)
    }

    const faintHr = (y) => {
      doc.setDrawColor(...C_DIM)
      doc.setLineWidth(0.1)
      doc.line(ML, y, W - ML, y)
    }

    const fieldLabel = (text, x, y) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(...C_BLUE)
      doc.text(text, x, y)
    }

    const newPage = () => {
      doc.addPage()
      bg()
    }

    const checkPageBreak = (y, reserve = 50) => {
      if (y > H - reserve) {
        newPage()
        return ML + 10
      }
      return y
    }

    // Replace non-latin1 characters that jsPDF can't encode
    const sanitize = (text = '') =>
      text
        .replace(/\u2014/g, '--')
        .replace(/\u2013/g, '-')
        .replace(/\u2018|\u2019/g, "'")
        .replace(/\u201C|\u201D/g, '"')
        .replace(/\u2026/g, '...')
        .replace(/\u2022/g, '-')
        .replace(/[^\x00-\xFF]/g, '?')

    // ── PAGE 1: COVER ────────────────────────────────────────────────────────
    bg()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(54)
    doc.setTextColor(...C_BLUE)
    doc.text('AXIOM', W / 2, 92, { align: 'center' })

    doc.setFontSize(13)
    doc.setTextColor(...C_WHITE)
    doc.text('MISSION CONSTRAINT DOCUMENT', W / 2, 106, { align: 'center' })

    hr(114)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...C_WHITE)
    doc.text(missionData.missionName, W / 2, 127, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...C_DIM)
    doc.text(missionData.missionType, W / 2, 136, { align: 'center' })
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`,
      W / 2, 144, { align: 'center' }
    )

    hr(153)

    doc.setFontSize(9)
    doc.setTextColor(...C_BLUE)
    doc.text('Autonomous eXploration Intent & Objective Manager', W / 2, 164, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...C_DIM)
    doc.text('Generated by AXIOM — Constitutional AI for Spacecraft', W / 2, H - 30, { align: 'center' })


    // ── PAGE 2: MISSION CONTEXT ──────────────────────────────────────────────
    newPage()
    let y = ML + 8

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...C_BLUE)
    doc.text('01 / MISSION CONTEXT', ML, y)
    y += 5; hr(y); y += 9

    fieldLabel('MISSION DESIGNATION', ML, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...C_WHITE)
    doc.text(missionData.missionName, ML, y); y += 9

    fieldLabel('MISSION TYPE', ML, y); y += 5
    doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(...C_WHITE)
    doc.text(missionData.missionType, ML, y); y += 11

    hr(y); y += 8

    fieldLabel('PRIMARY OBJECTIVE', ML, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...C_WHITE)
    const objLines = doc.splitTextToSize(missionData.objective, CW)
    doc.text(objLines, ML, y); y += objLines.length * 5.5 + 10

    hr(y); y += 8

    fieldLabel('KEY CONSTRAINTS', ML, y); y += 7
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
    missionData.keyConstraints.forEach((c) => {
      const lines = doc.splitTextToSize(`\u2022  ${c}`, CW - 4)
      doc.text(lines, ML + 2, y)
      y += lines.length * 5 + 2
    })
    y += 6

    hr(y); y += 8

    fieldLabel('OPERATIONAL ENVIRONMENT', ML, y); y += 6
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
    const envLines = doc.splitTextToSize(missionData.operationalEnvironment, CW)
    doc.text(envLines, ML, y)


    // ── PAGE 3: CONSTRAINT REGISTRY ──────────────────────────────────────────
    newPage()
    y = ML + 8

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C_BLUE)
    doc.text('02 / CONSTRAINT REGISTRY', ML, y)
    y += 5; hr(y); y += 7

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C_DIM)
    doc.text(`Total constraints registered: ${constraints.length}`, ML, y); y += 10

    constraints.forEach((c) => {
      // Sanitize all text fields before measuring or rendering
      const constraintText = sanitize(c.parsedConstraint)
      const rationaleText  = sanitize(c.rationale)
      const flags = (c.ambiguityFlags ?? []).filter(Boolean).map(sanitize)

      // Pre-calculate line counts so the page-break reserve matches actual block height
      doc.setFontSize(10)
      const cLines = doc.splitTextToSize(constraintText, CW - 6)
      doc.setFontSize(8.5)
      const fLines = flags.map((f) => doc.splitTextToSize(`[!] ${f}`, CW - 8))
      const rLines = doc.splitTextToSize(rationaleText, CW - 6)

      const blockHeight =
        6 +                                          // ID + tier row
        cLines.length * 5 + 3 +                     // constraint text
        fLines.reduce((a, fl) => a + fl.length * 5, 0) + // ambiguity flags
        rLines.length * 4.5 + 4 +                   // rationale
        6                                            // separator + spacing

      y = checkPageBreak(y, blockHeight + 15)

      const tc = TIER_C[c.priorityTier] || TIER_C.Ops

      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C_BLUE)
      doc.text(c.id, ML, y)
      doc.setFontSize(8); doc.setTextColor(...tc)
      doc.text(`[${c.priorityTier.toUpperCase()}]`, ML + 16, y)
      y += 6

      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
      doc.text(cLines, ML + 2, y); y += cLines.length * 5 + 3

      if (fLines.length > 0) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(255, 179, 0)
        fLines.forEach((fl) => { doc.text(fl, ML + 4, y); y += fl.length * 5 })
      }

      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...C_DIM)
      doc.text(rLines, ML + 2, y); y += rLines.length * 4.5 + 4

      faintHr(y - 1); y += 5
    })


    // ── PAGE 4: STRESS TEST RESULTS — COMPACT DASHBOARD ─────────────────────
    newPage()
    y = ML + 8

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C_BLUE)
    doc.text('03 / ADVERSARIAL STRESS TEST RESULTS', ML, y)
    y += 5; hr(y); y += 8

    const passC  = scenarios.filter((s) => s.outcome === 'pass').length
    const conflC = scenarios.filter((s) => s.outcome === 'conflict').length
    const gapC   = scenarios.filter((s) => s.outcome === 'gap').length
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.setTextColor(...OUT_C.pass);     doc.text(`PASS: ${passC}`,      ML,      y)
    doc.setTextColor(...OUT_C.conflict); doc.text(`CONFLICT: ${conflC}`, ML + 36, y)
    doc.setTextColor(...OUT_C.gap);      doc.text(`GAP: ${gapC}`,        ML + 86, y)
    y += 8; hr(y); y += 6

    scenarios.forEach((s, i) => {
      y = checkPageBreak(y, 22)
      const oc = OUT_C[s.outcome] || C_DIM

      // Outcome badge
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...oc)
      const badgeW = doc.getTextWidth(s.outcome.toUpperCase()) + 4
      doc.setFillColor(...oc.map((v) => Math.round(v * 0.15)))
      doc.roundedRect(ML, y - 4, badgeW, 5.5, 1, 1, 'F')
      doc.text(s.outcome.toUpperCase(), ML + 2, y)

      // Scenario number
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C_DIM)
      doc.text(String(i + 1).padStart(2, '0'), ML + badgeW + 4, y)

      // Constraint chips inline
      if (s.constraintsInvolved?.length > 0) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...C_BLUE)
        doc.text(s.constraintsInvolved.join('  '), ML + badgeW + 14, y)
      }
      y += 5.5

      // First sentence only
      const firstSentence = sanitize(
        s.scenario.match(/^[^.!?]*[.!?]/)?.[0] ?? s.scenario.substring(0, 120)
      )
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C_WHITE)
      const sumLines = doc.splitTextToSize(firstSentence, CW - 4)
      doc.text(sumLines, ML + 2, y); y += sumLines.length * 4.5 + 5

      faintHr(y - 2); y += 3
    })


    // ── PAGE 5: OPEN ITEMS — ENGINEERING DOCUMENT ────────────────────────────
    newPage()
    y = ML + 8

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C_BLUE)
    doc.text('04 / OPEN ITEMS FOR ENGINEERING REVIEW', ML, y)
    y += 5; hr(y); y += 7

    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...C_DIM)
    const noteLines = doc.splitTextToSize(
      'Items below require constraint revision or explicit precedence rules before autonomous deployment.',
      CW
    )
    doc.text(noteLines, ML, y); y += noteLines.length * 5 + 5
    hr(y); y += 9

    const openItems = scenarios.filter((s) => s.outcome === 'conflict' || s.outcome === 'gap')

    if (openItems.length === 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...OUT_C.pass)
      doc.text('No open items -- all scenarios passed.', ML, y)
    } else {
      openItems.forEach((item, itemIdx) => {
        const scenarioIdx = scenarios.indexOf(item)
        const oc = OUT_C[item.outcome]
        const itemText    = sanitize(item.scenario)
        const itemExpl    = sanitize(item.explanation)
        const citationIds = item.citations?.length ? item.citations : []

        doc.setFontSize(10)
        const sLines = doc.splitTextToSize(itemText, CW - 10)
        doc.setFontSize(8.5)
        const eLines = doc.splitTextToSize(itemExpl, CW - 10)

        const blockH =
          7 +                      // header row (checkbox + outcome + constraints)
          sLines.length * 5 + 3 +  // scenario text
          eLines.length * 4.5 +    // explanation
          (citationIds.length ? 5 : 0) +  // citation line
          10                       // separator + gap

        y = checkPageBreak(y, blockH + 10)

        // Checkbox for engineering sign-off
        doc.setDrawColor(...C_DIM); doc.setLineWidth(0.35)
        doc.rect(ML, y - 4, 4, 4)

        // Outcome badge
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...oc)
        doc.text(`[${item.outcome.toUpperCase()}]`, ML + 7, y)

        // Scenario number
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C_DIM)
        doc.text(String(scenarioIdx + 1).padStart(2, '0'), ML + 7 + 28, y)

        // Constraint chips
        if (item.constraintsInvolved?.length > 0) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C_BLUE)
          doc.text(item.constraintsInvolved.join('  '), ML + 7 + 38, y)
        }
        y += 6

        // Full scenario text
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
        doc.text(sLines, ML + 7, y); y += sLines.length * 5 + 3

        // Full explanation
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C_DIM)
        doc.text(eLines, ML + 7, y); y += eLines.length * 4.5

        // Inline citation IDs — each a clickable hyperlink to its source_url
        if (citationIds.length) {
          y += 1
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...C_BLUE)
          let cx = ML + 7
          citationIds.forEach((cid) => {
            const refEntry = getEntryById(cid)
            const tag = `[${cid}]`
            const tagW = doc.getTextWidth(tag)
            doc.text(tag, cx, y)
            if (refEntry?.source_url) {
              doc.link(cx, y - 2.5, tagW, 3, { url: refEntry.source_url })
            }
            cx += tagW + 1.5
          })
          y += 4
        }

        y += 6
        faintHr(y - 3); y += 4
      })
    }

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C_DIM)
    doc.text(
      `AXIOM Proof of Concept -- Not for operational use  |  ${new Date().toISOString()}`,
      W / 2, H - 18, { align: 'center' }
    )


    // ── PAGE 6: DATA SOURCES ─────────────────────────────────────────────────
    if (retrievedSources.length > 0) {
      newPage()
      y = ML + 8

      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C_BLUE)
      doc.text('05 / DATA SOURCES', ML, y)
      y += 5; hr(y); y += 8

      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...C_DIM)
      const dsNote = doc.splitTextToSize(
        'The following verified NASA and ESA sources informed the adversarial stress test analysis.',
        CW
      )
      doc.text(dsNote, ML, y); y += dsNote.length * 5 + 6
      hr(y); y += 8

      retrievedSources.forEach((entry) => {
        y = checkPageBreak(y, 40)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...C_BLUE)
        doc.text(`[${entry.id}]`, ML, y)
        y += 5
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
        const titleLines = doc.splitTextToSize(entry.title, CW - 4)
        doc.text(titleLines, ML + 2, y); y += titleLines.length * 5 + 2
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...C_DIM)
        const srcLines = doc.splitTextToSize(entry.source_document, CW - 4)
        doc.text(srcLines, ML + 2, y); y += srcLines.length * 4.5 + 2
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C_BLUE)
        const urlLines = doc.splitTextToSize(entry.source_url, CW - 4)
        urlLines.forEach((line, li) => {
          const lineY = y + li * 4.5
          doc.text(line, ML + 2, lineY)
          doc.link(ML + 2, lineY - 3, doc.getTextWidth(line), 3.5, { url: entry.source_url })
        })
        y += urlLines.length * 4.5 + 6
        faintHr(y - 3)
      })
    }


    // Post-processing: stamp footers on every page using its real page number
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFillColor(...C_BG)
      doc.rect(0, H - 16, W, 16, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...C_DIM)
      doc.text('AXIOM / CONFIDENTIAL', ML, H - 10)
      doc.text(String(i), W - ML, H - 10, { align: 'right' })
    }

    doc.save(`AXIOM_${missionData.missionName.replace(/\s+/g, '_')}_Constraint_Document.pdf`)
  }

  const counts = scenarios
    ? {
        pass: scenarios.filter((s) => s.outcome === 'pass').length,
        conflict: scenarios.filter((s) => s.outcome === 'conflict').length,
        gap: scenarios.filter((s) => s.outcome === 'gap').length,
      }
    : null

  return (
    <div className="axiom-stage">
      <div className="axiom-stress-header">
        <div className="axiom-stress-title-row">
          <h2 className="axiom-stress-title">ADVERSARIAL STRESS TEST</h2>
          {analysisVersion > 1 && (
            <span className="axiom-version-badge">ANALYSIS v{analysisVersion}</span>
          )}
        </div>
        <div className="axiom-section-sub">
          {missionData.missionName} / {constraints.length} constraints
        </div>
      </div>

      {!scenarios && !loading && (
        <div className="axiom-ready-panel">
          <div className="axiom-ready-title">ADVERSARIAL AGENT READY</div>
          <div className="axiom-ready-list">
            {[
              'Logical conflicts between constraints',
              'Coverage gaps in edge cases and boundary conditions',
              'Ambiguities that could be exploited or misinterpreted',
              'Scenarios technically compliant but violating mission intent',
            ].map((item, i) => (
              <div key={i} className="axiom-ready-item">
                <span className="axiom-ready-bullet">▸</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <button onClick={() => runTest(false)} className="axiom-btn-stress">
            EXECUTE STRESS TEST
          </button>
        </div>
      )}

      {loading && (
        <div className="axiom-loading-panel">
          <div className="axiom-radar-sweep">
            <div className="axiom-radar-ring" />
            <div className="axiom-radar-line" />
          </div>
          <div className="axiom-loading-text-main">RUNNING ADVERSARIAL ANALYSIS...</div>
          <div className="axiom-loading-sub">{loadingStatus}</div>
        </div>
      )}

      {error && (
        <div className="axiom-error-wrap">
          <ErrorBox msg={error} onRetry={() => runTest(false)} />
        </div>
      )}

      {scenarios && (
        <div className="axiom-results">
          {anyFixAccepted && (
            <button onClick={() => runTest(true)} className="axiom-btn-rerun-stress">
              RE-RUN STRESS TEST
            </button>
          )}

          <div className="axiom-summary-bar">
            <span className="axiom-summary-label">Results ({scenarios.length})</span>
            <span className="axiom-summary-pass">■ PASS: {counts.pass}</span>
            <span className="axiom-summary-conflict">■ CONFLICT: {counts.conflict}</span>
            <span className="axiom-summary-gap">■ GAP: {counts.gap}</span>
          </div>

          {retrievedSources.length > 0 && (
            <div className="axiom-data-sources">
              <button
                className="axiom-sources-header"
                onClick={() => setSourcesOpen((o) => !o)}
              >
                <span className="axiom-sources-label">↗ REFERENCE DATA</span>
                <span className="axiom-sources-chevron">{sourcesOpen ? '▲' : '▼'}</span>
              </button>
              {sourcesOpen && (
                <div className="axiom-sources-list">
                  {retrievedSources.map((entry) => (
                    <div key={entry.id} className="axiom-sources-row">
                      <span className="axiom-citation-id">{entry.id}</span>
                      <div className="axiom-sources-row-info">
                        <span className="axiom-sources-title">{entry.title}</span>
                        <span className="axiom-citation-source">{entry.source_document}</span>
                      </div>
                      <a
                        href={entry.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="axiom-citation-link"
                      >
                        →
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {scenarios.map((s, i) => {
            const colors = OUTCOME_COLORS[s.outcome] || OUTCOME_COLORS.gap
            const fixState = fixStates[i] || {}
            const canFix = s.outcome === 'conflict' || s.outcome === 'gap'

            return (
              <div
                key={i}
                className={`axiom-scenario-card${fixState.loading ? ' axiom-card-fixing' : ''}`}
                style={{
                  '--outcome-color': colors.border,
                  '--outcome-bg': colors.bg,
                  animationDelay: `${i * 0.1}s`,
                }}
              >
                <div className="axiom-scenario-header">
                  <div className="axiom-scenario-text">{s.scenario}</div>
                  <span className="axiom-outcome-badge" style={colors.badge}>
                    {s.outcome.toUpperCase()}
                  </span>
                </div>

                {s.constraintsInvolved?.length > 0 && (
                  <div className="axiom-involved-chips">
                    {s.constraintsInvolved.map((c, j) => (
                      <span key={j} className="axiom-involved-chip">{c}</span>
                    ))}
                  </div>
                )}

                <div className="axiom-scenario-explanation">{s.explanation}</div>

                {s.citations?.length > 0 && (
                  <div className="axiom-citation-row">
                    <button
                      className="axiom-btn-sources"
                      onClick={() =>
                        setCitationOpen((prev) => ({ ...prev, [i]: !prev[i] }))
                      }
                    >
                      ↗ SOURCES ({s.citations.length})
                    </button>
                    {citationOpen[i] && (
                      <div className="axiom-citation-panel">
                        {s.citations.map((cid) => {
                          const entry = getEntryById(cid)
                          if (!entry) return null
                          return (
                            <div key={cid} className="axiom-citation-entry">
                              <span className="axiom-citation-id">{cid}</span>
                              <div className="axiom-citation-info">
                                <span className="axiom-citation-title">{entry.title}</span>
                                <span className="axiom-citation-source">{entry.source_document}</span>
                              </div>
                              <a
                                href={entry.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="axiom-citation-link"
                              >
                                View Source →
                              </a>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {canFix && !fixState.accepted && (
                  <div className="axiom-fix-row">
                    <button
                      onClick={() => handleFix(s, i)}
                      disabled={fixState.loading || !!fixState.suggestion}
                      className="axiom-btn-fix"
                    >
                      {fixState.loading ? <><span className="axiom-spinner" /> GENERATING FIX...</> : 'FIX THIS'}
                    </button>
                  </div>
                )}

                {fixState.accepted && (
                  <div className="axiom-fix-accepted-badge">✓ FIX APPLIED</div>
                )}

                {fixState.error && !fixState.suggestion && (
                  <div className="axiom-error-wrap">
                    <ErrorBox msg={fixState.error} />
                  </div>
                )}

                {fixState.suggestion && (
                  <div className="axiom-fix-panel">
                    <div className="axiom-fix-panel-header">SUGGESTED RESOLUTION</div>
                    <div className="axiom-fix-constraint-text">
                      {fixState.suggestion.suggestedConstraint}
                    </div>
                    <div className="axiom-fix-label">REASONING</div>
                    <div className="axiom-fix-reasoning">{fixState.suggestion.reasoning}</div>
                    {fixState.suggestion.affectedConstraints?.length > 0 && (
                      <div className="axiom-involved-chips">
                        {fixState.suggestion.affectedConstraints.map((c, j) => (
                          <span key={j} className="axiom-involved-chip">{c}</span>
                        ))}
                      </div>
                    )}
                    {fixState.error && (
                      <div className="axiom-error-wrap">
                        <ErrorBox msg={fixState.error} />
                      </div>
                    )}
                    <div className="axiom-fix-actions">
                      <button
                        onClick={() => handleAcceptFix(fixState.suggestion, i)}
                        disabled={fixState.accepting}
                        className="axiom-btn-accept"
                      >
                        {fixState.accepting
                          ? <><span className="axiom-spinner" /> PROCESSING…</>
                          : 'ACCEPT FIX'}
                      </button>
                      <button
                        onClick={() => handleDismiss(i)}
                        disabled={fixState.accepting}
                        className="axiom-btn-dismiss"
                      >
                        DISMISS
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button onClick={() => runTest(false)} className="axiom-btn-rerun">
            RUN AGAIN
          </button>

          <button onClick={handleShare} className="axiom-btn-share">
            ↗ SHARE RESULTS
          </button>

          <button onClick={handleExport} className="axiom-btn-export">
            EXPORT CONSTRAINT DOCUMENT
          </button>
        </div>
      )}

      {toast && <div className="axiom-toast">{toast}</div>}
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [stage, setStage] = useState(1)
  const [missionData, setMissionData] = useState(null)
  const [constraints, setConstraints] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sharedState, setSharedState] = useState(null)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#state=')) return
    try {
      const decoded = JSON.parse(atob(hash.slice(7)))
      if (decoded.missionContext && decoded.constraints && decoded.stressTestResults) {
        setMissionData(decoded.missionContext)
        setConstraints(decoded.constraints)
        setSharedState(decoded)
        setStage(3)
        history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    } catch {}
  }, [])

  const goToConstraints = (data) => {
    setMissionData(data)
    setStage(2)
  }

  const goToStressTest = (cons) => {
    setConstraints(cons)
    setStage(3)
  }

  const addConstraint = (c) => setConstraints((prev) => [...prev, c])

  return (
    <div className="axiom-app">
      <div className="axiom-stars-bg" />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <NavBar stage={stage} missionData={missionData} onHamburgerClick={() => setDrawerOpen(true)} />
      <HeroSection />
      <main className="axiom-main">
        <StageTracker stage={stage} />
        {stage === 1 && <Stage1 onComplete={goToConstraints} />}
        {stage === 2 && missionData && (
          <Stage2 missionData={missionData} onComplete={goToStressTest} />
        )}
        {stage === 3 && missionData && (
          <Stage3
            missionData={missionData}
            constraints={constraints}
            onAddConstraint={addConstraint}
            initialScenarios={sharedState?.stressTestResults || null}
            initialRetrievedSources={sharedState?.retrievedSources || []}
          />
        )}
      </main>
    </div>
  )
}
