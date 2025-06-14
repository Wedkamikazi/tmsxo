import { Transaction } from '../types';

export interface DuplicateMatch {
  existingTransaction: Transaction;
  newTransaction: Transaction;
  matchScore: number;
  matchReasons: string[];
}

export interface DuplicateResolution {
  action: 'skip' | 'replace' | 'keep_both';
  reason: string;
}

export interface DuplicateAnalysis {
  potentialDuplicates: DuplicateMatch[];
  safeToImport: Transaction[];
  overlapPeriod: {
    start: string;
    end: string;
  };
  recommendations: {
    autoSkip: DuplicateMatch[];
    requiresReview: DuplicateMatch[];
  };
}

class DuplicateDetectionService {
  
  // Main function to analyze duplicates
  analyzeDuplicates(existingTransactions: Transaction[], newTransactions: Transaction[]): DuplicateAnalysis {
    const potentialDuplicates: DuplicateMatch[] = [];
    const safeToImport: Transaction[] = [];
    
    // Find overlap period
    const overlapPeriod = this.findOverlapPeriod(existingTransactions, newTransactions);
    
    for (const newTxn of newTransactions) {
      const duplicateMatch = this.findBestMatch(newTxn, existingTransactions);
      
      if (duplicateMatch && duplicateMatch.matchScore >= 0.8) {
        potentialDuplicates.push(duplicateMatch);
      } else {
        safeToImport.push(newTxn);
      }
    }
    
    // Categorize duplicates
    const recommendations = this.categorizeMatches(potentialDuplicates);
    
    return {
      potentialDuplicates,
      safeToImport,
      overlapPeriod,
      recommendations
    };
  }
  
  // Find the best matching existing transaction for a new transaction
  private findBestMatch(newTransaction: Transaction, existingTransactions: Transaction[]): DuplicateMatch | null {
    let bestMatch: DuplicateMatch | null = null;
    let highestScore = 0;
    
    for (const existing of existingTransactions) {
      const match = this.calculateMatch(existing, newTransaction);
      if (match.matchScore > highestScore) {
        highestScore = match.matchScore;
        bestMatch = match;
      }
    }
    
    return bestMatch && bestMatch.matchScore >= 0.6 ? bestMatch : null;
  }
  
  // Calculate match score between two transactions
  private calculateMatch(existing: Transaction, newTxn: Transaction): DuplicateMatch {
    const matchReasons: string[] = [];
    let score = 0;
    
    // Date match (most important) - use Post date if available, otherwise fall back to date
    const existingDate = existing.postDate || existing.date;
    const newDate = newTxn.postDate || newTxn.date;
    
    if (existingDate === newDate) {
      score += 0.4;
      matchReasons.push('Same post date');
      
      // If we have time information, check for exact time match
      if (existing.time && newTxn.time && existing.time === newTxn.time) {
        score += 0.1; // Bonus for exact time match
        matchReasons.push('Same time');
      }
    } else if (this.isWithinDays(existingDate, newDate, 1)) {
      score += 0.2;
      matchReasons.push('Post date within 1 day');
    }
    
    // Amount match (critical)
    if (Math.abs(existing.balance - newTxn.balance) < 0.01) {
      score += 0.3;
      matchReasons.push('Same balance');
    }
    
    if (Math.abs(existing.debitAmount - newTxn.debitAmount) < 0.01 && 
        Math.abs(existing.creditAmount - newTxn.creditAmount) < 0.01) {
      score += 0.2;
      matchReasons.push('Same debit/credit amounts');
    }
    
    // Description similarity
    const descSimilarity = this.calculateStringSimilarity(existing.description, newTxn.description);
    if (descSimilarity > 0.8) {
      score += 0.1;
      matchReasons.push('Very similar description');
    } else if (descSimilarity > 0.6) {
      score += 0.05;
      matchReasons.push('Similar description');
    }
    
    // Reference match
    if (existing.reference && newTxn.reference && existing.reference === newTxn.reference) {
      score += 0.1;
      matchReasons.push('Same reference');
    }
    
    return {
      existingTransaction: existing,
      newTransaction: newTxn,
      matchScore: Math.min(score, 1.0),
      matchReasons
    };
  }
  
  // Find overlap period between existing and new transactions
  private findOverlapPeriod(existing: Transaction[], newTxns: Transaction[]): { start: string; end: string } {
    if (existing.length === 0 || newTxns.length === 0) {
      return { start: '', end: '' };
    }
    
    // Use Post date if available, otherwise fall back to date
    const existingDates = existing.map(t => t.postDate || t.date).sort();
    const newDates = newTxns.map(t => t.postDate || t.date).sort();
    
    const existingStart = existingDates[0];
    const existingEnd = existingDates[existingDates.length - 1];
    const newStart = newDates[0];
    const newEnd = newDates[newDates.length - 1];
    
    // Find overlap
    const overlapStart = existingStart > newStart ? existingStart : newStart;
    const overlapEnd = existingEnd < newEnd ? existingEnd : newEnd;
    
    return overlapStart <= overlapEnd ? { start: overlapStart, end: overlapEnd } : { start: '', end: '' };
  }
  
  // Categorize matches into auto-skip and requires-review
  private categorizeMatches(matches: DuplicateMatch[]): { autoSkip: DuplicateMatch[]; requiresReview: DuplicateMatch[] } {
    const autoSkip: DuplicateMatch[] = [];
    const requiresReview: DuplicateMatch[] = [];
    
    for (const match of matches) {
      // High confidence matches (>= 0.9) can be auto-skipped
      if (match.matchScore >= 0.9) {
        autoSkip.push(match);
      } else {
        requiresReview.push(match);
      }
    }
    
    return { autoSkip, requiresReview };
  }
  
  // Helper: Check if two dates are within specified days
  private isWithinDays(date1: string, date2: string, days: number): boolean {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days;
  }
  
  // Helper: Calculate string similarity (simple implementation)
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - editDistance) / longer.length;
  }
  
  // Helper: Calculate Levenshtein distance
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  // Apply resolution to duplicates
  applyResolution(duplicates: DuplicateMatch[], resolutions: Map<string, DuplicateResolution>): Transaction[] {
    const finalTransactions: Transaction[] = [];
    
    for (const duplicate of duplicates) {
      const resolution = resolutions.get(duplicate.newTransaction.id);
      
      switch (resolution?.action) {
        case 'skip':
          // Don't add the new transaction
          break;
        case 'replace':
          // Add new transaction (existing will be removed elsewhere)
          finalTransactions.push(duplicate.newTransaction);
          break;
        case 'keep_both':
          // Add new transaction with modified ID to avoid conflicts
          finalTransactions.push({
            ...duplicate.newTransaction,
            id: `${duplicate.newTransaction.id}_duplicate`
          });
          break;
        default:
          // Default to skip for safety
          break;
      }
    }
    
    return finalTransactions;
  }
}

export const duplicateDetectionService = new DuplicateDetectionService(); 