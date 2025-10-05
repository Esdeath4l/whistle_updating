/**
 * Lightweight AI classifier for reports.
 * This is a pluggable, local implementation that can be replaced
 * with a cloud model or external service later.
 */
import type { IReport } from '../../shared/models/report';

export interface AIClassificationResult {
  labels: string[];
  primaryLabel?: string;
  confidence: number; // 0..1 heuristic
  // 0..100 risk/confidentiality score
  score: number;
  flagged: boolean;
  reasons?: string[];
}

// Basic rule-based classifier as a safe default.
export async function classifyReport(report: { message: string; category?: string; priority?: string }): Promise<AIClassificationResult> {
  const text = (report.message || '').toLowerCase();
  // If an external AI service is configured, try it first
  const aiServiceUrl = process.env.AI_SERVICE_URL;
  if (aiServiceUrl) {
    try {
      const resp = await fetch(aiServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: report.message, category: report.category, priority: report.priority })
      });
      if (resp.ok) {
        const json = await resp.json();
        const score = typeof json.score === 'number' ? Math.max(0, Math.min(100, Math.round(json.score))) : 0;
        const confidence = typeof json.confidence === 'number' ? Math.max(0, Math.min(1, json.confidence)) : Math.min(0.98, score / 100);
        const labels = Array.isArray(json.labels) ? json.labels : [];
        const primaryLabel = labels[0] || (report.priority === 'urgent' ? 'urgent' : 'other');
        const flagged = score > 70;
        return { labels, primaryLabel, confidence, score, flagged, reasons: json.reasons || [] };
      }
    } catch (err) {
      console.warn('⚠️ External AI service classification failed, falling back to local classifier:', err);
    }
  }
  const labels: string[] = [];
  const reasons: string[] = [];

  // Category hints
  if (report.category) {
    labels.push(report.category);
    reasons.push(`category:${report.category}`);
  }

  // Keyword matching for common cases
  const urgentTerms = ['help', 'emergency', 'urgent', 'bleeding', 'gun', 'fire', 'accident'];
  const harassmentTerms = ['harass', 'abuse', 'stalk', 'threat', 'insult', 'hate'];
  const safetyTerms = ['danger', 'unsafe', 'hazard', 'collapsed', 'blocked'];

  for (const t of urgentTerms) if (text.includes(t)) { labels.push('urgent'); reasons.push(`term:${t}`); }
  for (const t of harassmentTerms) if (text.includes(t)) { labels.push('harassment'); reasons.push(`term:${t}`); }
  for (const t of safetyTerms) if (text.includes(t)) { labels.push('safety'); reasons.push(`term:${t}`); }

  // Offensive content detection (simple)
  const offensive = ['fuck', 'shit', 'die', 'kill', 'threat', 'bomb'];
  const detectedOffensive = offensive.filter(o => text.includes(o));
  if (detectedOffensive.length) {
    labels.push('inappropriate');
    reasons.push(`offensive:${detectedOffensive.join(',')}`);
  }

  // Heuristic confidence: more clues => higher confidence
  const confidence = Math.min(0.2 + (labels.length * 0.25), 0.98);

  // Heuristic risk score (0-100) based on keywords and priority
  let score = Math.round(confidence * 60 + (report.priority === 'urgent' ? 30 : report.priority === 'high' ? 15 : 0));
  // Boost for certain high-risk terms
  if (text.includes('gun') || text.includes('bomb') || text.includes('kill')) score = Math.min(100, score + 20);
  if (detectedOffensive.length > 0) score = Math.min(100, score + 10);

  const flagged = score > 70;

  // Determine primary label heuristically
  const primaryLabel = labels.length ? labels[0] : (report.priority === 'urgent' ? 'urgent' : 'other');

  return {
    labels: Array.from(new Set(labels)),
    primaryLabel,
    confidence,
    score,
    flagged,
    reasons
  };
}

export default { classifyReport };
