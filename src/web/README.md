# Smart Apparel Web Frontend

Enterprise-grade React application for real-time athletic performance monitoring and analysis.

## Overview

The Smart Apparel Web Frontend provides a comprehensive interface for athletes, coaches, and medical professionals to monitor and analyze biomechanical and physiological data in real-time. Built with React 18, TypeScript 5, and Material Design 3.0, it offers a responsive, accessible, and performant user experience.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- Docker >= 24.0.0

## Quick Start

1. Clone the repository and navigate to the web directory:
```bash
git clone <repository-url>
cd src/web
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Start development server:
```bash
npm run dev
```

## Project Structure

```
src/
├── api/            # API integration layer
├── assets/         # Static assets and resources
├── components/     # Reusable React components
├── config/         # Application configuration
├── contexts/       # React context providers
├── features/       # Feature-specific components
├── hooks/          # Custom React hooks
├── interfaces/     # TypeScript interfaces
├── layouts/        # Page layout components
├── services/       # Business logic services
├── store/          # Redux store configuration
├── styles/         # Global styles and themes
├── test/           # Test utilities
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Development Guidelines

### Code Style

- Follow TypeScript strict mode guidelines
- Use functional components with hooks
- Implement proper error boundaries
- Follow Material Design 3.0 specifications
- Ensure WCAG 2.1 Level AA compliance

### State Management

- Use Redux Toolkit for global state
- Implement React Query for server state
- Utilize local state for component-specific data
- Follow Redux best practices for action/reducer organization

### Performance Optimization

- Implement code splitting using React.lazy
- Use React.memo for expensive computations
- Optimize bundle size with tree shaking
- Implement proper loading states
- Use virtualization for long lists

### Testing

Run tests using:
```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

Testing guidelines:
- Maintain >80% code coverage
- Write unit tests for all components
- Implement integration tests for critical flows
- Use React Testing Library best practices
- Include accessibility tests using axe-core

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run type-check` - Run TypeScript checks
- `npm run test` - Run test suite
- `npm run prepare` - Install git hooks

## Environment Configuration

Required environment variables:
```
VITE_API_URL=<api-endpoint>
VITE_WS_URL=<websocket-endpoint>
VITE_SENTRY_DSN=<sentry-dsn>
VITE_AUTH_DOMAIN=<auth-domain>
```

## Deployment

### Production Build

1. Build the application:
```bash
npm run build
```

2. Docker build:
```bash
docker build -t smart-apparel-web .
```

3. Run container:
```bash
docker run -p 80:80 smart-apparel-web
```

### CI/CD Pipeline

The project uses GitLab CI/CD with the following stages:
1. Build
2. Test
3. Security Scan
4. Deploy to Staging
5. E2E Tests
6. Deploy to Production

## Performance Monitoring

- Sentry for error tracking
- Google Analytics for user behavior
- Lighthouse for performance metrics
- Custom performance monitoring using Web Vitals

## Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- iOS Safari (latest 2 versions)
- Android Chrome (latest 2 versions)

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Clear node_modules and package-lock.json
   - Run `npm install` fresh
   - Verify Node.js version

2. **Development Server Issues**
   - Check port availability
   - Verify environment variables
   - Clear Vite cache

3. **Type Errors**
   - Run `npm run type-check`
   - Update TypeScript definitions
   - Check for missing dependencies

## Contributing

1. Create feature branch from develop
2. Follow commit message convention
3. Ensure tests pass
4. Submit PR with detailed description
5. Address review comments
6. Squash and merge after approval

## License

Copyright © 2023 Smart Apparel. All rights reserved.