import { CSVRow, Transaction, ImportSummary, ValidationError, ValidationRule, CSVTemplate } from '../types';

// CSV Template Configuration
export const CSV_TEMPLATE: CSVTemplate = {
  headers: ['Bank reference', 'Narrative', 'Customer reference', 'TRN type', 'Value date', 'Credit amount', 'Debit amount', 'Time', 'Post date', 'Balance'],
  validationRules: [
    { field: 'Bank reference', rule: 'required', message: 'Bank reference is required' },
    { field: 'Narrative', rule: 'required', message: 'Narrative is required' },
    { field: 'TRN type', rule: 'required', message: 'Transaction type is required' },
    { field: 'Value date', rule: 'required', message: 'Value date is required' },
    { field: 'Value date', rule: 'date', message: 'Value date must be in valid format (DD/MM/YYYY)' },
    { field: 'Post date', rule: 'required', message: 'Post date is required' },
    { field: 'Post date', rule: 'date', message: 'Post date must be in valid format (DD/MM/YYYY)' },
    { field: 'Credit amount', rule: 'number', message: 'Credit amount must be a valid number' },
    { field: 'Debit amount', rule: 'number', message: 'Debit amount must be a valid number' },
    { field: 'Balance', rule: 'required', message: 'Balance is required' },
    { field: 'Balance', rule: 'number', message: 'Balance must be a valid number' },

  ],
  sampleData: [
    {
      'Bank reference': '829471Z01W0W',
      'Narrative': 'HELLMANN SAUDI ARABIA TFR+',
      'Customer reference': 'INV241221276270',
      'TRN type': 'Transfer',
      'Value date': '31/12/2024',
      'Credit amount': '5,444.10',
      'Debit amount': '',
      'Time': '19:05',
      'Post date': '31/12/2024',
      'Balance': '20,784,406.54'
    },
    {
      'Bank reference': 'LP CPM4057MZ',
      'Narrative': 'TECHNICAL LINKS SERVICES COMPANY',
      'Customer reference': '609720',
      'TRN type': 'Transfer',
      'Value date': '30/12/2024',
      'Credit amount': '',
      'Debit amount': '15,000,000.00',
      'Time': '12:45',
      'Post date': '30/12/2024',
      'Balance': '15,010,179.45'
    },
    {
      'Bank reference': 'SDR5-00029',
      'Narrative': 'SEVING THOMAS THDMDIYIL SADAD',
      'Customer reference': 'NONREF',
      'TRN type': 'Cheque',
      'Value date': '01/01/2025',
      'Credit amount': '31,050.00',
      'Debit amount': '',
      'Time': '11:27',
      'Post date': '30/12/2024',
      'Balance': '33,922,117.24'
    }
  ]
};

class CSVProcessingService {
  
  // Generate CSV template for download
  generateTemplate(): string {
    const headers = CSV_TEMPLATE.headers.join(',');
    const rows = CSV_TEMPLATE.sampleData.map(row => 
      CSV_TEMPLATE.headers.map(header => `"${row[header] || ''}"`).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  // Download CSV template
  downloadTemplate(): void {
    const csvContent = this.generateTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'bank_statement_template.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Parse CSV content
  async parseCSV(file: File): Promise<CSVRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const csv = event.target?.result as string;
          const rows = this.parseCSVContent(csv);
          resolve(rows);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  private parseCSVContent(csv: string): CSVRow[] {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV must contain at least a header and one data row');
    
    const headers = this.parseCSVLine(lines[0]).map(h => h.trim());
    const expectedHeaders = [
      'bank reference',
      'narrative', 
      'customer reference',
      'trn type',
      'value date',
      'credit amount',
      'debit amount',
      'time',
      'post date',
      'balance'
    ];
    
    // Validate headers (case-insensitive)
    const normalizedHeaders = headers.map(h => h.toLowerCase());
    const missingHeaders = expectedHeaders.filter(h => !normalizedHeaders.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Create header mapping
    const headerMap: Record<string, number> = {};
    expectedHeaders.forEach(expectedHeader => {
      const index = normalizedHeaders.findIndex(h => h === expectedHeader);
      headerMap[expectedHeader.replace(' ', '')] = index;
    });

    // Parse data rows
    const dataRows: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0 || values.every(v => !v.trim())) continue; // Skip empty rows
      
      const row: CSVRow = {
        bankReference: values[headerMap.bankreference]?.trim() || '',
        narrative: values[headerMap.narrative]?.trim() || '',
        customerReference: values[headerMap.customerreference]?.trim() || '',
        trnType: values[headerMap.trntype]?.trim() || '',
        valueDate: values[headerMap.valuedate]?.trim() || '',
        creditAmount: values[headerMap.creditamount]?.trim() || '',
        debitAmount: values[headerMap.debitamount]?.trim() || '',
        time: values[headerMap.time]?.trim() || '',
        postDate: values[headerMap.postdate]?.trim() || '',
        balance: values[headerMap.balance]?.trim() || ''
      };
      
      dataRows.push(row);
    }
    
    return dataRows;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  // Validate CSV data
  validateCSVData(rows: CSVRow[]): ValidationError[] {
    const errors: ValidationError[] = [];
    
    rows.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header
      
      // Validate each field
      CSV_TEMPLATE.validationRules.forEach(rule => {
        const fieldValue = this.getFieldValue(row, rule.field);
        const error = this.validateField(fieldValue, rule, rowNumber);
        if (error) errors.push(error);
      });
      
      // For bank statements, we trust the balance field as it represents the actual account balance
      // Balance validation is disabled for bank statement imports as the data comes directly from the bank
      // and may not be in strict chronological order or may include pending transactions
    });
    
    return errors;
  }

  private getFieldValue(row: CSVRow, field: string): string {
    switch (field.toLowerCase()) {
      case 'bank reference': return row.bankReference;
      case 'narrative': return row.narrative;
      case 'customer reference': return row.customerReference;
      case 'trn type': return row.trnType;
      case 'value date': return row.valueDate;
      case 'credit amount': return row.creditAmount;
      case 'debit amount': return row.debitAmount;
      case 'time': return row.time;
      case 'post date': return row.postDate;
      case 'balance': return row.balance;
      default: return '';
    }
  }

  private validateField(value: string, rule: ValidationRule, rowNumber: number): ValidationError | null {
    switch (rule.rule) {
      case 'required':
        if (!value || value.trim() === '') {
          return { row: rowNumber, field: rule.field, message: rule.message, value };
        }
        break;
        
      case 'number':
        if (value.trim() && isNaN(this.parseAmount(value))) {
          return { row: rowNumber, field: rule.field, message: rule.message, value };
        }
        break;
        
      case 'date':
        if (value.trim() && !this.isValidDate(value)) {
          return { row: rowNumber, field: rule.field, message: rule.message, value };
        }
        break;
        
      case 'positive':
        if (value.trim() && this.parseAmount(value) < 0) {
          return { row: rowNumber, field: rule.field, message: rule.message, value };
        }
        break;
    }
    
    return null;
  }

  private parseAmount(value: string): number {
    if (!value || value.trim() === '') return 0;
    
    // Remove currency symbols, commas, and quotes, handle negative values
    const cleaned = value.replace(/[$,\s"]/g, '');
    
    // Handle negative values (with minus sign or parentheses)
    const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
    const numericValue = cleaned.replace(/[-()]/g, '');
    
    const amount = parseFloat(numericValue);
    
    if (isNaN(amount)) return 0;
    
    return isNegative ? -amount : amount;
  }

  private isValidDate(dateString: string): boolean {
    // Handle DD/MM/YYYY format (Saudi bank format)
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        
        // Basic range validation
        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
          // Create date object to validate the actual date (handles leap years, etc.)
          const date = new Date(year, month - 1, day);
          return date.getFullYear() === year && 
                 date.getMonth() === month - 1 && 
                 date.getDate() === day;
        }
      }
    }
    
    // Fallback to original logic
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  // Convert CSV rows to transactions
  convertToTransactions(rows: CSVRow[]): Transaction[] {
    const baseTimestamp = Date.now();
    return rows.map((row, index) => ({
      id: `txn_${baseTimestamp}_${index}_${Math.random().toString(36).substr(2, 9)}`,
      date: this.formatDate(row.postDate),
      description: row.narrative,
      debitAmount: Math.abs(this.parseAmount(row.debitAmount)), // Ensure debit amounts are positive for display
      creditAmount: Math.abs(this.parseAmount(row.creditAmount)), // Ensure credit amounts are positive for display
      balance: this.parseAmount(row.balance),
      reference: row.customerReference,
      postDate: row.postDate,
      time: row.time,
      valueDate: row.valueDate
    }));
  }

  private formatDate(dateString: string): string {
    // Handle DD/MM/YYYY format from bank statements (Saudi bank format)
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        
        // Validate the date parts
        const dayNum = parseInt(day);
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900) {
          // Convert DD/MM/YYYY to YYYY-MM-DD format
          return `${year}-${month}-${day}`;
        }
      }
    }
    
    // Fallback to original logic
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  // Helper method to create a sortable datetime from Post date and Time
  private createSortableDateTime(postDate: string, time: string): Date {
    const formattedDate = this.formatDate(postDate);
    
    // Handle time format (HH:MM)
    let timeString = '00:00';
    if (time && time.trim()) {
      timeString = time.trim();
      // Ensure time is in HH:MM format
      if (timeString.length === 4 && !timeString.includes(':')) {
        // Convert HHMM to HH:MM
        timeString = timeString.substring(0, 2) + ':' + timeString.substring(2);
      }
    }
    
    // Combine date and time
    const dateTimeString = `${formattedDate}T${timeString}:00`;
    return new Date(dateTimeString);
  }

  // Process file and generate import summary
  async processFile(file: File): Promise<ImportSummary> {
    try {
      const rows = await this.parseCSV(file);
      const validationErrors = this.validateCSVData(rows);
      const transactions = this.convertToTransactions(rows);
      
      // Sort transactions by Post date and time (newest first, matching bank statement order)
      const sortedTransactions = transactions.sort((a, b) => {
        const dateA = this.createSortableDateTime(a.postDate || a.date, a.time || '00:00');
        const dateB = this.createSortableDateTime(b.postDate || b.date, b.time || '00:00');
        return dateB.getTime() - dateA.getTime(); // Newest first (most recent transaction first)
      });
      
      const totalDebitAmount = transactions.reduce((sum, t) => sum + t.debitAmount, 0);
      const totalCreditAmount = transactions.reduce((sum, t) => sum + t.creditAmount, 0);
      
      // The closing balance is from the FIRST transaction (most recent) since bank statements are in reverse chronological order
      const closingBalance = transactions.length > 0 ? transactions[0].balance : 0;
      
      // Calculate opening balance from the LAST transaction (oldest)
      const openingBalance = transactions.length > 0 ? transactions[transactions.length - 1].balance : 0;
      
      // Calculate daily movement (net change)
      const dailyMovement = closingBalance - openingBalance;
      
      return {
        fileName: file.name,
        totalTransactions: transactions.length,
        totalDebitAmount,
        totalCreditAmount,
        closingBalance,
        openingBalance,
        dailyMovement,
        validationErrors,
        transactions: sortedTransactions,
        dateRange: {
          from: transactions.length > 0 ? sortedTransactions[sortedTransactions.length - 1].date : '',
          to: transactions.length > 0 ? sortedTransactions[0].date : ''
        }
      };
    } catch (error) {
      throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const csvProcessingService = new CSVProcessingService(); 