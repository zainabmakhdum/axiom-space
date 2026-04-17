import { useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'

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

function NavBar({ stage, missionData }) {
  return (
    <nav className="axiom-nav">
      <div className="axiom-nav-inner">
        <div className="axiom-nav-left">
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
                ANALYZING...
              </>
            ) : (
              'INITIALIZE MISSION'
            )}
          </button>
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
          {loading ? '···' : 'ADD'}
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

function Stage3({ missionData, constraints }) {
  const [scenarios, setScenarios] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const runTest = async () => {
    setLoading(true)
    setError('')
    setScenarios(null)
    try {
      const constraintList = constraints
        .map((c) => `${c.id} [${c.priorityTier}]: ${c.parsedConstraint}`)
        .join('\n')

      const res = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        system:
          'You are an adversarial autonomous agent specialized in finding loopholes, conflicts, and gaps in spacecraft mission constraint sets. ' +
          'Your role is to identify scenarios where constraints fail, conflict with each other, or leave dangerous coverage gaps. ' +
          'Be specific, technically rigorous, and creative. Think like an attacker stress-testing the system.',
        messages: [
          {
            role: 'user',
            content:
              `Mission: ${missionData.missionName} (${missionData.missionType})\n` +
              `Objective: ${missionData.objective}\n` +
              `Environment: ${missionData.operationalEnvironment}\n\n` +
              `Constraints:\n${constraintList}\n\n` +
              `Return ONLY a JSON array of exactly 6 adversarial scenarios. No markdown, no explanation.\n\n` +
              `[{"scenario":"...","constraintsInvolved":["C-01"],"outcome":"pass","explanation":"..."}]\n\n` +
              `outcome MUST be exactly one of: pass, conflict, gap`,
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
        <h2 className="axiom-stress-title">ADVERSARIAL STRESS TEST</h2>
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
          <button onClick={runTest} className="axiom-btn-stress">
            EXECUTE STRESS TEST
          </button>
        </div>
      )}

      {loading && (
        <div className="axiom-loading-panel">
          <div className="axiom-scan-line" />
          <div className="axiom-loading-text-main">RUNNING ADVERSARIAL ANALYSIS...</div>
          <div className="axiom-loading-sub">Probing constraint boundaries...</div>
        </div>
      )}

      {error && (
        <div className="axiom-error-wrap">
          <ErrorBox msg={error} onRetry={runTest} />
        </div>
      )}

      {scenarios && (
        <div className="axiom-results">
          <div className="axiom-summary-bar">
            <span className="axiom-summary-label">Results ({scenarios.length})</span>
            <span className="axiom-summary-pass">■ PASS: {counts.pass}</span>
            <span className="axiom-summary-conflict">■ CONFLICT: {counts.conflict}</span>
            <span className="axiom-summary-gap">■ GAP: {counts.gap}</span>
          </div>

          {scenarios.map((s, i) => {
            const colors = OUTCOME_COLORS[s.outcome] || OUTCOME_COLORS.gap
            return (
              <div
                key={i}
                className="axiom-scenario-card"
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
                      <span key={j} className="axiom-involved-chip">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                <div className="axiom-scenario-explanation">{s.explanation}</div>
              </div>
            )
          })}

          <button onClick={runTest} className="axiom-btn-rerun">
            RUN AGAIN
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [stage, setStage] = useState(1)
  const [missionData, setMissionData] = useState(null)
  const [constraints, setConstraints] = useState([])

  const goToConstraints = (data) => {
    setMissionData(data)
    setStage(2)
  }

  const goToStressTest = (cons) => {
    setConstraints(cons)
    setStage(3)
  }

  return (
    <div className="axiom-app">
      <div className="axiom-stars-bg" />
      <NavBar stage={stage} missionData={missionData} />
      <HeroSection />
      <main className="axiom-main">
        <StageTracker stage={stage} />
        {stage === 1 && <Stage1 onComplete={goToConstraints} />}
        {stage === 2 && missionData && (
          <Stage2 missionData={missionData} onComplete={goToStressTest} />
        )}
        {stage === 3 && missionData && (
          <Stage3 missionData={missionData} constraints={constraints} />
        )}
      </main>
    </div>
  )
}
