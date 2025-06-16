import { Transaction } from '../types';
import { StoredTransaction } from './unifiedDataService';

export interface DuplicateMatch {
  existingTransaction: Transaction;
  newTransaction: Transaction;
  matchScore: number;
  matchReasons: string[];
}

export interface SophisticatedDuplicateReport {
  duplicates: StoredTransaction[];
  analysis: {
    totalChecked: number;
    duplicatesFound: number;
    confidenceScores: number[];
    avgSimilarity: number;
  };
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
  
  // SOPHISTICATED DUPLICATE DETECTION (from dataIntegrityService)
  findSophisticatedDuplicates(transactions: StoredTransaction[]): SophisticatedDuplicateReport {
    const seen = new Map<string, StoredTransaction>();
    const duplicates: StoredTransaction[] = [];
    const confidenceScores: number[] = [];

    transactions.forEach(transaction => {
      // Create a more sophisticated duplicate detection key
      const normalizedDesc = transaction.description.trim().toLowerCase();
      const key = [
        transaction.accountId,
        transaction.date,
        transaction.debitAmount || 0,
        transaction.creditAmount || 0,
        normalizedDesc.substring(0, 50) // First 50 chars of description
      ].join('|');
      
      if (seen.has(key)) {
        // Additional validation - check if they're really duplicates
        const existing = seen.get(key)!;
        const similarity = this.areTransactionsDuplicates(existing, transaction);
        if (similarity > 0.9) {
          duplicates.push(transaction);
          confidenceScores.push(similarity);
        }
      } else {
        seen.set(key, transaction);
      }
    });

    return {
      duplicates,
      analysis: {
        totalChecked: transactions.length,
        duplicatesFound: duplicates.length,
        confidenceScores,
        avgSimilarity: confidenceScores.length > 0 ? 
          confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length : 0
      }
    };
  }

  // Enhanced duplicate detection with similarity scoring
  private areTransactionsDuplicates(t1: StoredTransaction, t2: StoredTransaction): number {
    // Same basic data
    if (t1.accountId !== t2.accountId || t1.date !== t2.date) return 0;
    if (t1.debitAmount !== t2.debitAmount || t1.creditAmount !== t2.creditAmount) return 0;
    
    // Similar descriptions (allow for minor variations)
    const desc1 = t1.description.trim().toLowerCase();
    const desc2 = t2.description.trim().toLowerCase();
    return this.calculateStringSimilarity(desc1, desc2);
  }

  // Calculate string similarity using Levenshtein distance
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Levenshtein distance calculation
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  // Find the best matching existing transaction for a new transaction
  private findBestMatch(newTransaction: Transaction, existingTransactions: Transaction[]): DuplicateMatch | null {
    let bestMatch: DuplicateMatch | null = null;
    let bestScore = 0;
    
    for (const existing of existingTransactions) {
      const match = this.calculateMatch(existing, newTransaction);
      if (match.matchScore > bestScore) {
        bestScore = match.matchScore;
        bestMatch = match;
      }
    }
    
    return bestMatch && bestMatch.matchScore >= 0.7 ? bestMatch : null;
  }
  
  // Calculate match score between two transactions
  private calculateMatch(existing: Transaction, newTxn: Transaction): DuplicateMatch {
    const matchReasons: string[] = [];
    let score = 0;
    
    // Date match (most important) - use formatted date, fallback to postDate if needed
    const existingDate = existing.date || existing.postDate;
    const newDate = newTxn.date || newTxn.postDate;
    
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
    
    // Description similarity (enhanced with sophisticated matching)
    const descSimilarity = this.calculateStringSimilarity(existing.description, newTxn.description);
    if (descSimilarity > 0.9) {
      score += 0.15;
      matchReasons.push('Highly similar description');
    } else if (descSimilarity > 0.8) {
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
  private findOverlapPeriod(existingTransactions: Transaction[], newTransactions: Transaction[]): { start: string; end: string } {
    const existingDates = existingTransactions.map(t => t.postDate || t.date).sort();
    const newDates = newTransactions.map(t => t.postDate || t.date).sort();
    
    const overlapStart = Math.max(
      new Date(existingDates[0] || '1900-01-01').getTime(),
      new Date(newDates[0] || '1900-01-01').getTime()
    );
    
    const overlapEnd = Math.min(
      new Date(existingDates[existingDates.length - 1] || '2100-01-01').getTime(),
      new Date(newDates[newDates.length - 1] || '2100-01-01').getTime()
    );
    
    return {
      start: new Date(overlapStart).toISOString().split('T')[0],
      end: new Date(overlapEnd).toISOString().split('T')[0]
    };
  }
  
  // Categorize matches into auto-skip and requires-review
  private categorizeMatches(matches: DuplicateMatch[]): { autoSkip: DuplicateMatch[]; requiresReview: DuplicateMatch[] } {
    const autoSkip: DuplicateMatch[] = [];
    const requiresReview: DuplicateMatch[] = [];
    
    matches.forEach(match => {
      if (match.matchScore >= 0.95) {
        autoSkip.push(match);
      } else {
        requiresReview.push(match);
      }
    });
    
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