/**
 * Data fixer service to repair existing data issues
 */

import { unifiedDataService } from './unifiedDataService';
import { fixPostDateTime } from '../utils/dateUtils';

class DataFixerService {
  
  /**
   * Fix invalid postDateTime values in stored transactions
   */
  fixInvalidPostDateTimes(): { fixed: number; total: number } {
    console.log('🔧 Data Fixer: Starting postDateTime repair...');
    
    let fixedCount = 0;
    let totalCount = 0;
    
    try {
      // Get all transactions
      const allTransactions = unifiedDataService.getAllTransactions();
      totalCount = allTransactions.length;
      
      console.log(`🔧 Data Fixer: Found ${totalCount} transactions to check`);
      
      // Check and fix each transaction
      const fixedTransactions = allTransactions.map(transaction => {
        // Check if postDateTime is invalid
        if (transaction.postDateTime) {
          const testDate = new Date(transaction.postDateTime);
          if (isNaN(testDate.getTime())) {
            // Invalid postDateTime - fix it
            const fixedDateTime = fixPostDateTime(transaction.postDateTime);
            fixedCount++;
            
            console.log(`🔧 Data Fixer: Fixed postDateTime "${transaction.postDateTime}" -> "${fixedDateTime}"`);
            
            return {
              ...transaction,
              postDateTime: fixedDateTime
            };
          }
        }
        
        // Transaction is OK or doesn't have postDateTime
        return transaction;
      });
      
      // Update all transactions if any were fixed
      if (fixedCount > 0) {
        console.log(`🔧 Data Fixer: Updating ${fixedCount} transactions with fixed postDateTime values`);
        
        // We need to update transactions through localStorage directly since there's no bulk update method
        try {
          const localStorage = window.localStorage;
          const transactionsKey = 'transactions';
          localStorage.setItem(transactionsKey, JSON.stringify(fixedTransactions));
          console.log(`✅ Data Fixer: Successfully fixed ${fixedCount} out of ${totalCount} transactions`);
        } catch (error) {
          console.error('❌ Data Fixer: Error updating transactions:', error);
        }
        
      } else {
        console.log(`✅ Data Fixer: All ${totalCount} transactions have valid postDateTime values`);
      }
      
    } catch (error) {
      console.error('❌ Data Fixer: Error fixing postDateTime values:', error);
    }
    
    return { fixed: fixedCount, total: totalCount };
  }
  
  /**
   * Run all data fixes
   */
  runAllFixes(): void {
    console.log('🔧 Data Fixer: Starting comprehensive data repair...');
    
    const postDateTimeResult = this.fixInvalidPostDateTimes();
    
    console.log('✅ Data Fixer: All repairs completed');
    console.log(`📊 Data Fixer Summary:
    - PostDateTime fixes: ${postDateTimeResult.fixed}/${postDateTimeResult.total}
    `);
  }
  
}

export const dataFixerService = new DataFixerService(); 