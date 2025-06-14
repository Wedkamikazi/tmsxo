import React from 'react';
import { DataHub } from './components/DataHub';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/globals.css';

function App(): React.ReactElement {
  return (
    <ErrorBoundary componentName="App">
      <div className="App">
        <ErrorBoundary componentName="DataHub">
          <DataHub />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}

export default App; 