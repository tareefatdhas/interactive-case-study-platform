import type { Highlight } from '@/types';

// Interface for aggregated highlights
export interface PopularHighlight {
  text: string;
  count: number;
  studentIds: string[];
  recentCount: number; // Count of highlights from last 30 minutes
  colors: { [color: string]: number }; // Color distribution
  sectionIndex: number;
  sectionTitle: string;
  firstHighlightedAt: Date;
  lastHighlightedAt: Date;
  heatScore: number; // Computed score based on frequency and recency
}

// Interface for section highlight stats
export interface SectionHighlightStats {
  sectionIndex: number;
  sectionTitle: string;
  totalHighlights: number;
  uniqueStudents: number;
  mostPopularText: string;
  averageHighlightsPerStudent: number;
  recentActivity: number; // Highlights in last 30 minutes
}

/**
 * Check if two text strings are similar enough to be considered the same highlight
 * Uses simple similarity check for overlapping substrings
 */
function areTextsSimilar(text1: string, text2: string, threshold = 0.7): boolean {
  const t1 = text1.toLowerCase().trim();
  const t2 = text2.toLowerCase().trim();
  
  // Exact match
  if (t1 === t2) return true;
  
  // Check if one is a substring of the other
  if (t1.includes(t2) || t2.includes(t1)) return true;
  
  // Simple similarity check based on common words
  const words1 = new Set(t1.split(/\s+/));
  const words2 = new Set(t2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  const similarity = intersection.size / union.size;
  return similarity >= threshold;
}

/**
 * Calculate heat score based on frequency and engagement
 */
function calculateHeatScore(
  count: number,
  recentCount: number,
  lastHighlightedAt: Date
): number {
  // Base score from total highlight count
  const baseScore = count * 10;
  
  // Small bonus for recent activity (indicates ongoing engagement)
  // but don't weight it heavily to avoid position bias
  const recentActivityBonus = recentCount > 0 ? 5 : 0;
  
  return baseScore + recentActivityBonus;
}

/**
 * Aggregate highlights by text similarity and calculate popularity metrics
 */
export function aggregateHighlights(highlights: Highlight[]): PopularHighlight[] {
  const groups: Map<string, Highlight[]> = new Map();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  // Group highlights by similar text
  for (const highlight of highlights) {
    let foundGroup = false;
    
    for (const [groupText, groupHighlights] of groups.entries()) {
      if (areTextsSimilar(highlight.text, groupText)) {
        groupHighlights.push(highlight);
        foundGroup = true;
        break;
      }
    }
    
    if (!foundGroup) {
      groups.set(highlight.text, [highlight]);
    }
  }
  
  // Convert groups to PopularHighlight objects
  const popularHighlights: PopularHighlight[] = [];
  
  for (const [groupText, groupHighlights] of groups.entries()) {
    // Use the most common text as the representative text
    const textCounts = new Map<string, number>();
    groupHighlights.forEach(h => {
      textCounts.set(h.text, (textCounts.get(h.text) || 0) + 1);
    });
    const representativeText = [...textCounts.entries()]
      .sort(([,a], [,b]) => b - a)[0][0];
    
    // Calculate metrics
    const uniqueStudentIds = [...new Set(groupHighlights.map(h => h.studentId))];
    const recentHighlights = groupHighlights.filter(h => 
      h.createdAt.toDate() > thirtyMinutesAgo
    );
    const colorCounts = new Map<string, number>();
    groupHighlights.forEach(h => {
      colorCounts.set(h.color, (colorCounts.get(h.color) || 0) + 1);
    });
    
    const sortedHighlights = groupHighlights.sort(
      (a, b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime()
    );
    
    const firstHighlight = sortedHighlights[0];
    const lastHighlight = sortedHighlights[sortedHighlights.length - 1];
    
    const popularHighlight: PopularHighlight = {
      text: representativeText,
      count: groupHighlights.length,
      studentIds: uniqueStudentIds,
      recentCount: recentHighlights.length,
      colors: Object.fromEntries(colorCounts),
      sectionIndex: firstHighlight.sectionIndex,
      sectionTitle: firstHighlight.sectionTitle,
      firstHighlightedAt: firstHighlight.createdAt.toDate(),
      lastHighlightedAt: lastHighlight.createdAt.toDate(),
      heatScore: calculateHeatScore(
        groupHighlights.length,
        recentHighlights.length,
        lastHighlight.createdAt.toDate()
      )
    };
    
    popularHighlights.push(popularHighlight);
  }
  
  // Sort by heat score (descending)
  return popularHighlights.sort((a, b) => b.heatScore - a.heatScore);
}

/**
 * Get popular highlights for a specific section
 */
export function getPopularHighlightsForSection(
  highlights: Highlight[],
  sectionIndex: number,
  limit = 10
): PopularHighlight[] {
  const sectionHighlights = highlights.filter(h => h.sectionIndex === sectionIndex);
  const aggregated = aggregateHighlights(sectionHighlights);
  return aggregated.slice(0, limit);
}

/**
 * Get highlight statistics by section
 */
export function getHighlightStatsBySection(highlights: Highlight[]): SectionHighlightStats[] {
  const sectionGroups = new Map<number, Highlight[]>();
  
  // Group by section
  highlights.forEach(highlight => {
    const sectionIndex = highlight.sectionIndex;
    if (!sectionGroups.has(sectionIndex)) {
      sectionGroups.set(sectionIndex, []);
    }
    sectionGroups.get(sectionIndex)!.push(highlight);
  });
  
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const stats: SectionHighlightStats[] = [];
  
  for (const [sectionIndex, sectionHighlights] of sectionGroups.entries()) {
    const uniqueStudents = new Set(sectionHighlights.map(h => h.studentId)).size;
    const recentActivity = sectionHighlights.filter(h => 
      h.createdAt.toDate() > thirtyMinutesAgo
    ).length;
    
    const aggregated = aggregateHighlights(sectionHighlights);
    const mostPopular = aggregated[0];
    
    stats.push({
      sectionIndex,
      sectionTitle: sectionHighlights[0]?.sectionTitle || `Section ${sectionIndex + 1}`,
      totalHighlights: sectionHighlights.length,
      uniqueStudents,
      mostPopularText: mostPopular ? mostPopular.text.substring(0, 50) + '...' : 'None',
      averageHighlightsPerStudent: uniqueStudents > 0 ? 
        Math.round((sectionHighlights.length / uniqueStudents) * 10) / 10 : 0,
      recentActivity
    });
  }
  
  return stats.sort((a, b) => a.sectionIndex - b.sectionIndex);
}

/**
 * Get overall highlight metrics for a session
 */
export function getSessionHighlightMetrics(highlights: Highlight[]) {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const uniqueStudents = new Set(highlights.map(h => h.studentId)).size;
  const recentHighlights = highlights.filter(h => h.createdAt.toDate() > thirtyMinutesAgo);
  const aggregated = aggregateHighlights(highlights);
  
  return {
    totalHighlights: highlights.length,
    uniqueStudents,
    recentActivity: recentHighlights.length,
    popularHighlights: aggregated.slice(0, 5),
    sectionsWithHighlights: new Set(highlights.map(h => h.sectionIndex)).size,
    averageHighlightsPerStudent: uniqueStudents > 0 ? 
      Math.round((highlights.length / uniqueStudents) * 10) / 10 : 0
  };
}