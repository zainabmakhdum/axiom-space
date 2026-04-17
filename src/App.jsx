import { useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import { jsPDF } from 'jspdf'

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
      y = checkPageBreak(y, 52)
      const tc = TIER_C[c.priorityTier] || TIER_C.Ops

      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...C_BLUE)
      doc.text(c.id, ML, y)
      doc.setFontSize(8); doc.setTextColor(...tc)
      doc.text(`[${c.priorityTier.toUpperCase()}]`, ML + 16, y)
      y += 6

      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
      const cLines = doc.splitTextToSize(c.parsedConstraint, CW - 2)
      doc.text(cLines, ML + 2, y); y += cLines.length * 5 + 3

      const flags = c.ambiguityFlags?.filter(Boolean) ?? []
      if (flags.length > 0) {
        doc.setFontSize(8.5); doc.setTextColor(255, 179, 0)
        flags.forEach((f) => { doc.text(`[!] ${f}`, ML + 4, y); y += 5 })
      }

      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...C_DIM)
      const rLines = doc.splitTextToSize(c.rationale, CW - 4)
      doc.text(rLines, ML + 2, y); y += rLines.length * 4.5 + 4

      faintHr(y - 1); y += 5
    })


    // ── PAGE 4: STRESS TEST RESULTS ──────────────────────────────────────────
    newPage()
    y = ML + 8

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C_BLUE)
    doc.text('03 / ADVERSARIAL STRESS TEST RESULTS', ML, y)
    y += 5; hr(y); y += 8

    const passC    = scenarios.filter((s) => s.outcome === 'pass').length
    const conflC   = scenarios.filter((s) => s.outcome === 'conflict').length
    const gapC     = scenarios.filter((s) => s.outcome === 'gap').length
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
    doc.setTextColor(...OUT_C.pass);     doc.text(`PASS: ${passC}`,         ML,      y)
    doc.setTextColor(...OUT_C.conflict); doc.text(`CONFLICT: ${conflC}`,    ML + 36, y)
    doc.setTextColor(...OUT_C.gap);      doc.text(`GAP: ${gapC}`,           ML + 86, y)
    y += 8; hr(y); y += 8

    scenarios.forEach((s, i) => {
      y = checkPageBreak(y, 58)
      const oc = OUT_C[s.outcome] || C_DIM
      const blockStartY = y - 3

      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...oc)
      doc.text(s.outcome.toUpperCase(), ML + 5, y)
      doc.setTextColor(...C_DIM)
      doc.text(String(i + 1).padStart(2, '0'), W - ML, y, { align: 'right' })
      y += 5

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
      const sLines = doc.splitTextToSize(s.scenario, CW - 7)
      doc.text(sLines, ML + 5, y); y += sLines.length * 5 + 2

      if (s.constraintsInvolved?.length > 0) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...C_BLUE)
        doc.text(s.constraintsInvolved.join('   '), ML + 5, y); y += 5
      }

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...C_DIM)
      const eLines = doc.splitTextToSize(s.explanation, CW - 7)
      doc.text(eLines, ML + 5, y); y += eLines.length * 4.5 + 3

      doc.setDrawColor(...oc); doc.setLineWidth(1.8)
      doc.line(ML, blockStartY, ML, y)
      y += 6

      faintHr(y - 3); y += 2
    })


    // ── PAGE 5: OPEN ITEMS ────────────────────────────────────────────────────
    newPage()
    y = ML + 8

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...C_BLUE)
    doc.text('04 / OPEN ITEMS FOR ENGINEERING REVIEW', ML, y)
    y += 5; hr(y); y += 8

    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...C_DIM)
    const noteLines = doc.splitTextToSize(
      'The following items require resolution before autonomous deployment.',
      CW
    )
    doc.text(noteLines, ML, y); y += noteLines.length * 5 + 6
    hr(y); y += 9

    const openItems = scenarios.filter((s) => s.outcome === 'conflict' || s.outcome === 'gap')

    if (openItems.length === 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...OUT_C.pass)
      doc.text('No open items — all scenarios passed.', ML, y)
    } else {
      openItems.forEach((item) => {
        y = checkPageBreak(y, 55)
        const oc = OUT_C[item.outcome]

        doc.setDrawColor(...C_DIM); doc.setLineWidth(0.3)
        doc.rect(ML, y - 3.5, 3.5, 3.5)

        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...oc)
        doc.text(`[${item.outcome.toUpperCase()}]`, ML + 6, y)
        if (item.constraintsInvolved?.length > 0) {
          doc.setTextColor(...C_BLUE)
          doc.text(item.constraintsInvolved.join(', '), ML + 6 + 26, y)
        }
        y += 5.5

        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...C_WHITE)
        const sLines = doc.splitTextToSize(item.scenario, CW - 8)
        doc.text(sLines, ML + 6, y); y += sLines.length * 5 + 2

        doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(...C_DIM)
        const eLines = doc.splitTextToSize(item.explanation, CW - 8)
        doc.text(eLines, ML + 6, y); y += eLines.length * 4.5 + 8

        faintHr(y - 4)
      })
    }

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...C_DIM)
    doc.text(
      `AXIOM Proof of Concept — Not for operational use  |  ${new Date().toISOString()}`,
      W / 2, H - 18, { align: 'center' }
    )

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

          <button onClick={handleExport} className="axiom-btn-export">
            EXPORT CONSTRAINT DOCUMENT
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
