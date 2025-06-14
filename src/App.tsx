import React from 'react';
import { DataHub } from './components/DataHub';
import { Transaction, BankAccount } from './types';
import './styles/globals.css';

function App(): React.ReactElement {
  const handleTransactionImport = (transactions: Transaction[], bankAccount: BankAccount): void => {
    console.log(`Successfully imported ${transactions.length} transactions for ${bankAccount.name}`);
    // Here you would typically:
    // 1. Save transactions to local database
    // 2. Update bank account balance
    // 3. Trigger any necessary business logic
    // 4. Show success notification
  };

  return (
    <div className="App">
      <DataHub onTransactionImport={handleTransactionImport} />
    </div>
  );
}

export default App; 