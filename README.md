# Laboratory Information System - Frontend

A modern, responsive Laboratory Information System (LIS) frontend built with React, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Modern UI** - Clean, intuitive interface with shadcn/ui components
- 👥 **Role-Based Access** - Separate portals for Admin, Lab Tech, and Receptionist
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- 🔄 **Real-time Updates** - Live notifications via WebSocket
- 🧪 **Test Management** - Browse and select from test catalog
- 📋 **Order Processing** - Complete order workflow from registration to results
- 🔬 **Result Matching** - Match analyzer results to patient samples
- 💰 **Payment Processing** - Multiple payment methods with receipt printing
- 📊 **Dashboard Analytics** - Real-time metrics and charts
- 🖨️ **Report Generation** - Professional lab reports with print support
- 🌐 **Offline Support** - Graceful handling of network issues

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Real-time**: Socket.IO Client
- **HTTP Client**: Axios

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Configure your API URL in .env
VITE_API_URL=http://localhost:3000
```

### Running the Application

```bash
# Development
pnpm run dev

# Build for production
pnpm run build

# Preview production build
pnpm run preview
```

The application will be available at `http://localhost:8080`

## User Roles

### Admin Portal
- User management
- Test catalog management
- System reports and analytics
- Audit logs
- Machine configuration

### Lab Tech Portal
- Sample collection
- Result entry and verification
- Match analyzer results
- QC data entry
- Machine monitoring

### Receptionist Portal
- Patient registration
- Order creation
- Payment processing
- Receipt printing
- Result viewing

## Default Credentials

After seeding the database:

```
Email: admin@hobour.com
Password: Admin@123
```

## Project Structure

```
src/
├── components/         # Reusable UI components
│   ├── ui/            # shadcn/ui components
│   ├── layout/        # Layout components
│   ├── dashboard/     # Dashboard widgets
│   └── ...
├── pages/             # Page components
│   ├── admin/         # Admin portal pages
│   ├── lab/           # Lab tech portal pages
│   └── reception/     # Reception portal pages
├── hooks/             # Custom React hooks
├── context/           # React context providers
├── services/          # API services
├── types/             # TypeScript type definitions
└── lib/               # Utility functions
```

## Key Features

### Analyzer Integration
- Real-time result import from laboratory analyzers
- Manual sample ID matching interface
- Support for HL7, ASTM, and LIS2-A2 protocols
- Live connection monitoring

### Order Management
- Quick patient search
- Multi-test selection
- Priority levels (Routine, Urgent, STAT)
- Discount support
- Multiple payment methods

### Result Management
- Automated result flagging (Normal, High, Low, Critical)
- Reference range display
- Result verification workflow
- Professional report generation

### Real-time Features
- Live order updates
- Result notifications
- Machine status monitoring
- WebSocket reconnection handling

## Environment Variables

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## Scripts

```bash
pnpm run dev        # Start development server
pnpm run build      # Build for production
pnpm run preview    # Preview production build
pnpm run lint       # Run ESLint
pnpm run test       # Run tests
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Performance

- Code splitting for optimal loading
- Lazy loading of routes
- Image optimization
- Efficient re-rendering with React Query

## Accessibility

- WCAG 2.1 Level AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support

## License

Proprietary - Hobour Diagnostics

## Support

For issues or questions, contact the development team.
