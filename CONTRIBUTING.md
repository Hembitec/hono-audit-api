# Contributing to Hono Website Audit API

Thank you for your interest in contributing to the Hono Website Audit API! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Setting up the Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/hono-audit-api.git
   cd hono-audit-api
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## 🛠️ Development Workflow

### Code Style

- Use TypeScript with strict mode enabled
- Follow the existing code style and patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Testing

Before submitting changes:

1. Build the project: `npm run build`
2. Test the API endpoints manually or with tools like curl/Postman
3. Verify the web UI works correctly at `http://localhost:3000`

### Making Changes

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the code style guidelines
3. Test your changes thoroughly
4. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add new audit feature"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a Pull Request

## 📝 Commit Message Guidelines

Use conventional commit messages:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## 🐛 Reporting Issues

When reporting issues, please include:

- Node.js version
- Operating system
- Steps to reproduce the issue
- Expected vs actual behavior
- Error messages or logs

## 💡 Feature Requests

We welcome feature requests! Please:

- Check if the feature already exists or is planned
- Describe the use case and benefits
- Provide examples if possible

## 📚 Areas for Contribution

- **New audit features**: Additional SEO checks, accessibility audits, etc.
- **Performance improvements**: Optimization of browser usage, parsing speed
- **Documentation**: API documentation, examples, tutorials
- **Testing**: Unit tests, integration tests
- **UI improvements**: Better web interface, visualizations
- **Deployment**: Docker support, cloud platform integrations

## 🔧 Project Structure

```
src/
├── index.ts           # Main Hono app
├── services/          # Core business logic
│   ├── auditor.ts     # Main orchestration
│   ├── browser.ts     # Puppeteer management
│   ├── parser.ts      # HTML parsing
│   └── validator.ts   # Input validation
├── types/             # TypeScript definitions
└── utils/             # Helper functions
```

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Code of Conduct

Please be respectful and constructive in all interactions. We're here to build something great together!

## ❓ Questions?

Feel free to open an issue for questions or reach out to the maintainers.

Thank you for contributing! 🎉
