import { localStorageManager } from '../services/localStorageManager';

/**
 * Data Migration Utility for fixing postDateTime formats
 * 
 * This utility fixes transactions that were created with the old CSV processing logic
 * that used raw postDate values instead of properly formatted dates.
 */
export class DateMigrationUtils {
  
  /**
   * Format a date string to YYYY-MM-DD format
   * Handles various input formats: MM/DD/YYYY, DD/MM/YYYY, MMDDYYYY
   */
  private static formatDate(dateString: string): string {
    // If already in correct format (YYYY-MM-DD), return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // Handle slash-separated dates (MM/DD/YYYY or DD/MM/YYYY)
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const part1 = parseInt(parts[0]);
        const part2 = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Log for debugging
        if (isNaN(part1) || isNaN(part2) || isNaN(year)) {
          console.warn(`Invalid date parts in formatDate: "${dateString}" -> [${part1}, ${part2}, ${year}]`);
          return dateString; // Return original if parsing fails
        }
        
        let month: number, day: number;
        
        // Determine if it's MM/DD/YYYY or DD/MM/YYYY format
        // If first part > 12, it must be DD/MM/YYYY
        // If second part > 12, it must be MM/DD/YYYY
        // Otherwise, prefer DD/MM/YYYY (European format) based on user's CSV data
        if (part1 > 12) {
          // DD/MM/YYYY format
          day = part1;
          month = part2;
        } else if (part2 > 12) {
          // MM/DD/YYYY format
          month = part1;
          day = part2;
        } else {
          // Ambiguous - assume DD/MM/YYYY (European format) based on user's bank CSV
          day = part1;
          month = part2;
        }
        
        // Validate the date parts
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
          // Convert to YYYY-MM-DD format
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
    
    // Fallback to original logic for other formats
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('Failed to parse date:', dateString, error);
    }
    
    return dateString; // Return original if all parsing fails
  }
  
  /**
   * Check if a postDateTime value is invalid (contains unformatted dates)
   */
  private static isInvalidPostDateTime(postDateTime: string): boolean {
    try {
      const date = new Date(postDateTime);
      return isNaN(date.getTime());
    } catch {
      return true;
    }
  }
  
  /**
   * Extract the date part from a postDateTime string and format it properly
   */
  private static fixPostDateTime(postDateTime: string, time?: string): string {
    // Split postDateTime to get date and time parts
    const parts = postDateTime.split('T');
    if (parts.length === 2) {
      const datePart = parts[0];
      const timePart = time || parts[1] || '00:00:00';
      
      // Format the date part
      const formattedDate = this.formatDate(datePart);
      
      // Ensure time part has seconds
      let formattedTime = timePart;
      if (formattedTime && !formattedTime.includes(':')) {
        // Convert HHMM to HH:MM:SS
        if (formattedTime.length === 4) {
          formattedTime = `${formattedTime.substring(0, 2)}:${formattedTime.substring(2)}:00`;
        }
      } else if (formattedTime && formattedTime.split(':').length === 2) {
        // Add seconds if missing
        formattedTime += ':00';
      }
      
      return `${formattedDate}T${formattedTime}`;
    }
    
    // If no 'T' separator, assume it's just a date
    const formattedDate = this.formatDate(postDateTime);
    return `${formattedDate}T${time || '00:00:00'}`;
  }
  
  /**
   * Migrate all transactions to fix postDateTime format issues
   */
  public static migrateTransactionDates(): {
    totalProcessed: number;
    totalFixed: number;
    errors: string[];
  } {
    const result = {
      totalProcessed: 0,
      totalFixed: 0,
      errors: [] as string[]
    };
    
    try {
      console.log('🔄 Starting postDateTime migration...');
      
      // Get all accounts
      const accounts = localStorageManager.getAllAccounts();
      
              for (const account of accounts) {
          try {
            // Get transactions for this account
            const transactions = localStorageManager.getTransactionsByAccount(account.id);
            const fixedTransactions: any[] = [];
            let accountFixed = 0;
            
            for (const transaction of transactions) {
              result.totalProcessed++;
              
              // Check if postDateTime is invalid
              if (this.isInvalidPostDateTime(transaction.postDateTime)) {
                try {
                  // Fix the postDateTime using the transaction's date and time
                  const fixedPostDateTime = this.fixPostDateTime(
                    transaction.postDateTime, 
                    transaction.time
                  );
                  
                  // Create fixed transaction
                  const fixedTransaction = {
                    ...transaction,
                    postDateTime: fixedPostDateTime
                  };
                  
                  fixedTransactions.push(fixedTransaction);
                  result.totalFixed++;
                  accountFixed++;
                  
                  console.log(`✅ Fixed transaction ${transaction.id}: "${transaction.postDateTime}" -> "${fixedPostDateTime}"`);
                } catch (error) {
                  const errorMsg = `Failed to fix transaction ${transaction.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                  result.errors.push(errorMsg);
                  console.error('❌', errorMsg);
                  fixedTransactions.push(transaction); // Keep original if fix fails
                }
              } else {
                fixedTransactions.push(transaction); // Keep valid transactions as-is
              }
            }
            
            // If we fixed any transactions, we need to replace all transactions
            if (accountFixed > 0) {
              // Delete old transactions for this account
              localStorageManager.deleteTransactionsByAccount(account.id);
              // Add the fixed transactions back
              localStorageManager.addTransactions(fixedTransactions);
              console.log(`✅ Fixed ${accountFixed} transactions in account "${account.name}"`);
            }
          
        } catch (error) {
          const errorMsg = `Failed to process account ${account.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error('❌', errorMsg);
        }
      }
      
      console.log(`🎉 Migration complete! Fixed ${result.totalFixed} out of ${result.totalProcessed} transactions`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️ ${result.errors.length} errors occurred during migration:`);
        result.errors.forEach(error => console.warn(error));
      }
      
    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      console.error('💥', errorMsg);
    }
    
    return result;
  }
  
  /**
   * Check how many transactions need migration (for analysis only)
   */
  public static analyzeTransactionDates(): {
    totalTransactions: number;
    invalidTransactions: number;
    sampleInvalidDates: string[];
  } {
    const result = {
      totalTransactions: 0,
      invalidTransactions: 0,
      sampleInvalidDates: [] as string[]
    };
    
    try {
      const accounts = localStorageManager.getAllAccounts();
      
      for (const account of accounts) {
        const transactions = localStorageManager.getTransactionsByAccount(account.id);
        
        for (const transaction of transactions) {
          result.totalTransactions++;
          
          if (this.isInvalidPostDateTime(transaction.postDateTime)) {
            result.invalidTransactions++;
            
            // Collect sample of invalid dates for analysis
            if (result.sampleInvalidDates.length < 10) {
              result.sampleInvalidDates.push(transaction.postDateTime);
            }
          }
        }
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    }
    
    return result;
  }
}

// Export convenience functions
export const migrateTransactionDates = DateMigrationUtils.migrateTransactionDates.bind(DateMigrationUtils);
export const analyzeTransactionDates = DateMigrationUtils.analyzeTransactionDates.bind(DateMigrationUtils); 