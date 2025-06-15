import React from 'react';
import { DataHub } from './components/DataHub';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemInitializer } from './components/SystemInitializer';
import './styles/globals.css';

function App(): React.ReactElement {
  return (
    <ErrorBoundary componentName="App">
      <SystemInitializer>
        <div className="App">
          <ErrorBoundary componentName="DataHub">
            <DataHub />
          </ErrorBoundary>
        </div>
      </SystemInitializer>
    </ErrorBoundary>
  );
}

export default App; 