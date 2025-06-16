// Data Fix Utility for Invalid Date Issues
// This utility fixes postDateTime fields that were created using raw postDate instead of formatted date

import { unifiedDataService, type StoredTransaction } from '../services/unifiedDataService';

// Fix existing transactions with incorrect postDateTime values
export function fixInvalidTransactionDates(): { fixed: number; total: number } {
  const allTransactions = unifiedDataService.getAllTransactions();
  let fixedCount = 0;
  
  console.log(`🔧 Data Fix: Processing ${allTransactions.length} transactions...`);
  
  const fixedTransactions: StoredTransaction[] = allTransactions.map(transaction => {
    // Check if the postDateTime creates an invalid date
    const currentPostDateTime = new Date(transaction.postDateTime);
    
    if (isNaN(currentPostDateTime.getTime())) {
      // Invalid postDateTime detected, reconstruct using formatted date
      const newPostDateTime = `${transaction.date}T${transaction.time || '00:00'}:00`;
      const testDate = new Date(newPostDateTime);
      
      if (!isNaN(testDate.getTime())) {
        // Successfully created valid date, fix this transaction
        fixedCount++;
        console.log(`🔧 Fixed transaction ${transaction.id}: "${transaction.postDateTime}" → "${newPostDateTime}"`);
        
        return {
          ...transaction,
          postDateTime: newPostDateTime
        };
      } else {
        console.warn(`⚠️ Could not fix transaction ${transaction.id}: date="${transaction.date}", time="${transaction.time}"`);
      }
    }
    
    return transaction;
  });
  
  // Save the fixed transactions back to localStorage
  if (fixedCount > 0) {
    // Clear existing data and add fixed transactions
    localStorage.removeItem('tms_transactions');
    unifiedDataService.addTransactions(fixedTransactions);
    
    console.log(`✅ Data Fix Complete: Fixed ${fixedCount} out of ${allTransactions.length} transactions`);
  } else {
    console.log(`✅ Data Fix Complete: No transactions needed fixing`);
  }
  
  return { fixed: fixedCount, total: allTransactions.length };
}

// Validate all transaction dates
export function validateTransactionDates(): { valid: number; invalid: number; invalidTransactions: string[] } {
  const allTransactions = unifiedDataService.getAllTransactions();
  const invalidTransactions: string[] = [];
  let validCount = 0;
  
  allTransactions.forEach(transaction => {
    const postDateTime = new Date(transaction.postDateTime);
    
    if (isNaN(postDateTime.getTime())) {
      invalidTransactions.push(`${transaction.id}: "${transaction.postDateTime}"`);
    } else {
      validCount++;
    }
  });
  
  return {
    valid: validCount,
    invalid: invalidTransactions.length,
    invalidTransactions
  };
}

// Format date using the same logic as CSV processing service
function formatDate(dateString: string): string {
  // Handle slash-separated dates
  if (dateString.includes('/')) {
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const part1 = parseInt(parts[0]);
      const part2 = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      
      if (isNaN(part1) || isNaN(part2) || isNaN(year)) {
        console.warn(`Invalid date parts in formatDate: "${dateString}" -> [${part1}, ${part2}, ${year}]`);
        return dateString;
      }
      
      let month: number, day: number;
      
      // Determine format (prioritize DD/MM/YYYY based on user's CSV)
      if (part1 > 12) {
        // DD/MM/YYYY format
        day = part1;
        month = part2;
      } else if (part2 > 12) {
        // MM/DD/YYYY format
        month = part1;
        day = part2;
      } else {
        // Ambiguous - assume DD/MM/YYYY (European format)
        day = part1;
        month = part2;
      }
      
      // Validate and convert to YYYY-MM-DD format
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
        const monthStr = month.toString().padStart(2, '0');
        const dayStr = day.toString().padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}`;
      }
    }
  }
  
  // Handle MMDDYYYY format (no separators)
  if (dateString.length === 8 && /^\d{8}$/.test(dateString)) {
    const month = parseInt(dateString.substring(0, 2));
    const day = parseInt(dateString.substring(2, 4));
    const year = parseInt(dateString.substring(4, 8));
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
      const monthStr = month.toString().padStart(2, '0');
      const dayStr = day.toString().padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
  }
  
  // Fallback: try to parse as-is
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return dateString;
}

// Advanced fix that also handles raw postDate formatting
export function fixInvalidTransactionDatesAdvanced(): { fixed: number; total: number; errors: string[] } {
  const allTransactions = unifiedDataService.getAllTransactions();
  const errors: string[] = [];
  let fixedCount = 0;
  
  console.log(`🔧 Advanced Data Fix: Processing ${allTransactions.length} transactions...`);
  
  const fixedTransactions: StoredTransaction[] = allTransactions.map(transaction => {
    // Check if the postDateTime creates an invalid date
    const currentPostDateTime = new Date(transaction.postDateTime);
    
    if (isNaN(currentPostDateTime.getTime())) {
      // Try to fix using formatted date first
      let newPostDateTime = `${transaction.date}T${transaction.time || '00:00'}:00`;
      let testDate = new Date(newPostDateTime);
      
      if (isNaN(testDate.getTime()) && transaction.postDate) {
        // If that fails, try formatting the raw postDate
        const formattedDate = formatDate(transaction.postDate);
        newPostDateTime = `${formattedDate}T${transaction.time || '00:00'}:00`;
        testDate = new Date(newPostDateTime);
      }
      
      if (!isNaN(testDate.getTime())) {
        // Successfully created valid date
        fixedCount++;
        console.log(`🔧 Fixed transaction ${transaction.id}: "${transaction.postDateTime}" → "${newPostDateTime}"`);
        
        return {
          ...transaction,
          date: newPostDateTime.split('T')[0], // Update the date field too
          postDateTime: newPostDateTime
        };
      } else {
        const error = `Could not fix transaction ${transaction.id}: date="${transaction.date}", postDate="${transaction.postDate}", time="${transaction.time}"`;
        errors.push(error);
        console.error(`❌ ${error}`);
      }
    }
    
    return transaction;
  });
  
  // Save the fixed transactions back to localStorage
  if (fixedCount > 0) {
    // Clear existing data and add fixed transactions
    localStorage.removeItem('tms_transactions');
    unifiedDataService.addTransactions(fixedTransactions);
    
    console.log(`✅ Advanced Data Fix Complete: Fixed ${fixedCount} out of ${allTransactions.length} transactions`);
  } else {
    console.log(`✅ Advanced Data Fix Complete: No transactions needed fixing`);
  }
  
  return { fixed: fixedCount, total: allTransactions.length, errors };
} 