/**
 * AI Moderation Service
 * Simple content moderation for report messages
 */

export interface ModerationResult {
  isAppropriate: boolean;
  flaggedTerms: string[];
  severity: 'low' | 'medium' | 'high';
  confidence: number;
}

// Simple keyword-based moderation (can be replaced with AI service)
const OFFENSIVE_TERMS = [
  'fuck', 'shit', 'damn', 'hell', 'bastard', 'bitch',
  'kill', 'die', 'murder', 'suicide', 'death',
  'hate', 'stupid', 'idiot', 'moron', 'retard'
];

const SEVERE_TERMS = [
  'kill', 'murder', 'suicide', 'death', 'bomb', 'weapon',
  'threat', 'harm', 'violence', 'attack'
];

/**
 * Moderate content for inappropriate language
 */
export function moderateContent(text: string): ModerationResult {
  const lowercaseText = text.toLowerCase();
  const words = lowercaseText.split(/\s+/);
  
  const flaggedTerms: string[] = [];
  let maxSeverity: 'low' | 'medium' | 'high' = 'low';
  
  // Check for offensive terms
  words.forEach(word => {
    const cleanWord = word.replace(/[^\w]/g, '');
    
    if (SEVERE_TERMS.includes(cleanWord)) {
      flaggedTerms.push(cleanWord);
      maxSeverity = 'high';
    } else if (OFFENSIVE_TERMS.includes(cleanWord)) {
      flaggedTerms.push(cleanWord);
      if (maxSeverity === 'low') maxSeverity = 'medium';
    }
  });
  
  // Calculate confidence based on number of flagged terms
  const confidence = Math.min(flaggedTerms.length * 0.3, 1.0);
  
  return {
    isAppropriate: flaggedTerms.length === 0,
    flaggedTerms: [...new Set(flaggedTerms)], // Remove duplicates
    severity: maxSeverity,
    confidence
  };
}

/**
 * Get moderation message for display
 */
export function getModerationMessage(result: ModerationResult): string {
  if (result.isAppropriate) {
    return '';
  }
  
  switch (result.severity) {
    case 'high':
      return '⚠️ Your message contains potentially harmful content. Please revise before submitting.';
    case 'medium':
      return '⚠️ Your message contains inappropriate language. Consider revising.';
    case 'low':
    default:
      return '💡 Please keep your message professional and appropriate.';
  }
}