/**
 * Text analysis utilities for achievement tracking
 */

/**
 * Extract unique words from text, normalized for counting
 * @param text - The text to analyze
 * @returns Array of unique words (lowercase, alphanumeric only)
 */
export function extractUniqueWords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Convert to lowercase and extract words (alphanumeric + basic punctuation)
  const words = text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ') // Keep only word characters, spaces, hyphens, and apostrophes
    .split(/\s+/)
    .filter(word => word.length > 2) // Filter out very short words
    .filter(word => !isCommonWord(word)) // Filter out common stop words
    .map(word => word.replace(/['-]/g, '')); // Remove hyphens and apostrophes for normalization

  // Return unique words only
  return [...new Set(words)];
}

/**
 * Count unique words from multiple text responses
 * @param responses - Array of response texts
 * @returns Number of unique words across all responses
 */
export function countUniqueWordsInResponses(responses: string[]): number {
  const allUniqueWords = new Set<string>();
  
  responses.forEach(response => {
    const uniqueWords = extractUniqueWords(response);
    uniqueWords.forEach(word => allUniqueWords.add(word));
  });
  
  return allUniqueWords.size;
}

/**
 * Check if a word is a common stop word that shouldn't count toward uniqueness
 * @param word - The word to check
 * @returns True if it's a common word that should be filtered out
 */
function isCommonWord(word: string): boolean {
  const commonWords = new Set([
    // Articles
    'the', 'a', 'an',
    // Prepositions
    'in', 'on', 'at', 'by', 'for', 'with', 'to', 'of', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over',
    // Pronouns
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
    // Conjunctions
    'and', 'or', 'but', 'so', 'yet', 'nor', 'because', 'since', 'while', 'although', 'though', 'if', 'unless', 'until', 'when', 'where', 'why', 'how',
    // Common verbs
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
    // Common adverbs
    'not', 'no', 'yes', 'very', 'too', 'also', 'just', 'only', 'even', 'still', 'already', 'yet', 'again', 'more', 'most', 'much', 'many', 'some', 'any', 'all', 'both', 'each', 'every', 'other', 'another',
    // Common adjectives
    'good', 'bad', 'big', 'small', 'new', 'old', 'first', 'last', 'long', 'short', 'high', 'low', 'right', 'left', 'next', 'same', 'different',
    // Other common words
    'there', 'here', 'now', 'then', 'today', 'tomorrow', 'yesterday', 'time', 'way', 'well', 'back', 'out', 'off', 'down', 'get', 'got', 'make', 'made', 'take', 'took', 'come', 'came', 'go', 'went', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told', 'ask', 'asked', 'work', 'worked', 'seem', 'seemed', 'feel', 'felt', 'try', 'tried', 'leave', 'left', 'call', 'called'
  ]);
  
  return commonWords.has(word);
}

/**
 * Calculate effort score based on unique word count and response length
 * @param text - The response text
 * @returns Effort score (0-100)
 */
export function calculateResponseEffort(text: string): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const uniqueWords = extractUniqueWords(text);
  const totalWords = text.split(/\s+/).length;
  const uniqueWordCount = uniqueWords.length;
  
  // Base score from unique word count (0-70 points)
  let score = Math.min(uniqueWordCount * 2, 70);
  
  // Bonus for response length (0-20 points)
  if (totalWords >= 50) score += 10;
  if (totalWords >= 100) score += 10;
  
  // Bonus for vocabulary diversity (0-10 points)
  const diversityRatio = totalWords > 0 ? uniqueWordCount / totalWords : 0;
  if (diversityRatio > 0.7) score += 10;
  else if (diversityRatio > 0.5) score += 5;
  
  return Math.min(score, 100);
}
