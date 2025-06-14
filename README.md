<<<<<<< HEAD
# Treasury Management System

A comprehensive, local-first treasury management system built with React and TypeScript. This application operates entirely offline with no external connections, providing secure financial data management for organizations.

## Features

### DataHub - Data Entry and Processing

#### 🏦 Bank Statement Import

- **Drag-and-drop CSV file upload** with support for multiple files
- **Batch processing** of multiple bank statement files
- **Bank account selection** from predefined accounts
- **CSV template download** with validation rules and sample data
- **Real-time validation** with detailed error reporting
- **Manual transaction editing** capabilities
- **Balance verification** and reconciliation
- **Step-by-step import process** with confirmation workflow

#### Key Validation Features

- ✅ **Header validation** - Ensures CSV files have required columns
- ✅ **Data type validation** - Validates dates, numbers, and required fields
- ✅ **Balance calculation verification** - Checks running balance accuracy
- ✅ **Debit amount handling** - Processes debits as positive values (no minus signs in calculations)
- ✅ **Transaction count and totals** - Provides comprehensive import summaries

#### Supported CSV Format

```csv
Date,Description,Debit,Credit,Balance,Reference
2024-01-15,Initial Deposit,,10000.00,10000.00,DEP001
2024-01-16,Office Supplies,250.00,,9750.00,CHK001
2024-01-17,Client Payment,,5000.00,14750.00,TRF001
```

## Architecture

### Frontend Stack

- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Strict type safety with no `any` types allowed
- **CSS Custom Properties** - Apple-inspired design system
- **Local Storage** - Client-side data persistence

### Design Philosophy

- **Desktop-first** responsive design optimized for desktop treasury workflows
- **Apple-inspired** modern UI with clean typography and smooth interactions
- **Accessible** WCAG-compliant interface with proper semantic markup
- **Professional** treasury-focused UX patterns

### Project Structure

src/
├── components/          # React components
│   ├── DataHub.tsx     # Main DataHub container with tabs
│   ├── BankStatementImport.tsx  # Bank statement import workflow
│   ├── FileUpload.tsx  # Drag-and-drop file upload component
│   └── *.css          # Component-specific styles
├── services/           # Business logic and data processing
│   ├── bankAccountService.ts    # Bank account management
│   └── csvProcessingService.ts  # CSV parsing and validation
├── types/             # TypeScript type definitions
│   └── index.ts       # All application types
└── styles/           # Global styles and design system
    └── globals.css   # Design tokens and base styles

## Getting Started

### Prerequisites

- Node.js 16 or higher
- npm or yarn package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd treasury-management-system

# Install dependencies
npm install

# Start development server
npm start
```

The application will open at `http://localhost:3000`

### Building for Production

```bash
# Create production build
npm run build

# The build folder contains the compiled application
```

## Usage Guide

### Importing Bank Statements

1. **Navigate to DataHub** → Bank Statements tab
2. **Download CSV Template** using the "Download CSV Template" button
3. **Prepare your data** using the template format:
   - Date: YYYY-MM-DD or MM/DD/YYYY format
   - Description: Transaction description
   - Debit: Positive numbers only (no minus signs)
   - Credit: Positive numbers only
   - Balance: Running balance after transaction
   - Reference: Optional transaction reference

4. **Upload CSV files** by dragging and dropping or browsing
5. **Select bank account** from the dropdown
6. **Review and edit** transactions as needed
7. **Confirm import** to complete the process

### CSV Template Rules

- All debit amounts should be positive numbers
- Balance calculations are automatically verified
- Required fields: Date, Description, Balance
- Optional fields: Reference
- Either Debit OR Credit should have a value (not both)

## Security & Privacy

- **No external connections** - All data stays local
- **No cloud services** - Complete offline operation
- **Local storage only** - Data persisted in browser storage
- **No user tracking** - Privacy-focused design

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run test suite
- `npm run eject` - Eject from Create React App (not recommended)

### Code Standards

- **TypeScript strict mode** enabled
- **No `any` types** allowed
- **ESLint** with React and TypeScript rules
- **Consistent naming** conventions throughout

### Adding New Features

1. Create TypeScript interfaces in `src/types/`
2. Implement business logic in `src/services/`
3. Build React components in `src/components/`
4. Add comprehensive CSS with design system tokens

## Roadmap

### Phase 1: DataHub Foundation ✅

- [x] Bank Statement Import
- [x] CSV Processing & Validation
- [x] File Upload Interface
- [x] Bank Account Management

### Phase 2: Additional Data Sources (Coming Soon)

- [ ] Payroll Data Import
- [ ] Investment Portfolio Data
- [ ] Financial Reports Generation
- [ ] Advanced Validation Rules

### Phase 3: Advanced Features (Planned)

- [ ] Data Export Capabilities
- [ ] Audit Trail and Logging
- [ ] Advanced Reconciliation Tools
- [ ] Custom Validation Rules

## Contributing

This is a local-first treasury application designed for secure financial data management. When contributing:

1. Maintain TypeScript strict compliance
2. Follow the existing design system
3. Ensure all features work offline
4. Add comprehensive documentation
5. Test with realistic financial data scenarios

## License

This project is designed for internal treasury management use. Please ensure compliance with your organization's data handling policies.

## Support

For technical support or feature requests, please refer to your internal IT documentation or treasury management guidelines.
=======
# tmsxo
>>>>>>> 06058817002a855552d46ae50b1b6e9510560409
