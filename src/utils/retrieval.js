import csliMissions from '../data/csli_missions.json';
import esaDebris from '../data/esa_debris.json';
import nasaAnomalies from '../data/nasa_anomalies.json';

function scoreEntry(entry, missionContext, constraints) {
  let score = 0;
  const searchText = [
    missionContext?.missionType || '',
    missionContext?.objective || '',
    missionContext?.operationalEnvironment || '',
    ...(missionContext?.keyConstraints || []),
    ...constraints.map(c => c.parsedConstraint || ''),
    ...constraints.map(c => c.priorityTier || '')
  ].join(' ').toLowerCase();

  const keywords = entry.keywords || entry.regime_keywords || [];
  keywords.forEach(keyword => {
    if (searchText.includes(keyword.toLowerCase())) score += 2;
  });

  if (entry.mission_type) {
    const missionType = (missionContext?.missionType || '').toLowerCase();
    if (missionType.includes('orbital') && entry.mission_type === 'orbital_survey') score += 3;
    if (missionType.includes('rover') && entry.mission_type === 'surface_rover') score += 3;
    if (missionType.includes('comms') && entry.mission_type === 'comms_relay') score += 3;
    if (missionType.includes('lunar') || (missionContext?.objective || '').toLowerCase().includes('lunar')) {
      if (entry.mission_type === 'lunar_survey') score += 5;
      if (entry.id === 'ESA-LUNAR-001') score += 5;
    }
  }

  const hasPowerConstraint = constraints.some(c => c.priorityTier === 'Power');
  const hasSafetyConstraint = constraints.some(c => c.priorityTier === 'Safety');
  const hasDebrisKeyword = constraints.some(c =>
    (c.parsedConstraint || '').toLowerCase().includes('debris') ||
    (c.parsedConstraint || '').toLowerCase().includes('collision')
  );

  if (hasPowerConstraint && entry.category === 'power_anomaly') score += 4;
  if (hasSafetyConstraint && hasDebrisKeyword) {
    if (entry.id?.startsWith('ESA')) score += 4;
  }
  if (hasDebrisKeyword && entry.category === 'gnc_anomaly') score += 2;

  return score;
}

export function retrieveRelevantContext(missionContext, constraints) {
  const allEntries = [...csliMissions, ...esaDebris, ...nasaAnomalies];

  const scored = allEntries
    .map(entry => ({ entry, score: scoreEntry(entry, missionContext, constraints) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  const csli = scored.filter(({ entry }) => entry.id?.startsWith('CSLI')).slice(0, 2);
  const esa = scored.filter(({ entry }) => entry.id?.startsWith('ESA')).slice(0, 2);
  const gsfc = scored.filter(({ entry }) => entry.id?.startsWith('GSFC')).slice(0, 3);

  return [...csli, ...esa, ...gsfc].map(({ entry }) => entry);
}

export function formatContextForPrompt(entries) {
  if (!entries.length) return '';

  return `

REAL-WORLD REFERENCE DATA FOR THIS ANALYSIS:
The following verified data from NASA and ESA sources is relevant to this mission.
When generating scenarios, reference specific entries by their ID (e.g. [GSFC-AN-001])
when that data directly informed the scenario.

${entries.map(e => `
[${e.id}] ${e.title}
Source: ${e.source_document}
Key Facts: ${e.key_facts || e.description}
Constraint Implication: ${e.constraint_lesson || e.constraint_implication}
`).join('\n---\n')}

END REFERENCE DATA.
When a scenario is directly informed by one of the above entries, include its ID in the citations array.
`;
}

export function getEntryById(id) {
  const all = [...csliMissions, ...esaDebris, ...nasaAnomalies];
  return all.find(e => e.id === id) || null;
}
