# Hono Website Audit API

A comprehensive website auditing API built with Hono.js that analyzes webpages and returns detailed audit data including SEO metrics, performance data, Core Web Vitals, accessibility, security headers, and detected technologies.

## Features

- 🔍 **SEO Analysis**: Extracts titles, meta descriptions, and Open Graph tags.
- ⚡ **Performance Metrics**: Measures page load times and Core Web Vitals (LCP, FID, CLS).
- ♿ **Accessibility Audit**: Checks for WCAG violations using `axe-core`.
- 🛡️ **Security Analysis**: Analyzes security headers like Content-Security-Policy.
- 💻 **Technology Detection**: Identifies the technology stack of the website.
- 📄 **Content Analysis**: Parses headings, images, and page structure.
- 🔗 **Resource Detection**: Analyzes links, scripts, and stylesheets.

## Tech Stack

- **Framework**: Hono.js
- **Browser Automation**: Playwright
- **HTML Parsing**: Cheerio
- **Language**: TypeScript
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Install Playwright's browser binaries:
    ```bash
    npx playwright install --with-deps
    ```

### Starting the Server

-   **Development Mode**:
    ```bash
    npm run dev
    ```
-   **Production Mode**:
    ```bash
    npm start
    ```

The API will be available at `http://localhost:3000`.

## API Endpoints

### 1. `GET /audit`

Performs a comprehensive audit of the specified website.

-   **URL**: `/audit?url={website_url}`
-   **Example**:
    ```bash
    curl "http://localhost:3000/audit?url=https://example.com"
    ```
-   **With Screenshot**:
    ```bash
    curl "http://localhost:3000/audit?url=https://example.com&includeScreenshot=true"
    ```

### 2. `GET /audit/quick`

Performs a faster, customizable audit with limited data.

-   **URL**: `/audit/quick?url={website_url}&checks={checks}`
-   **Example**:
    ```bash
    curl "http://localhost:3000/audit/quick?url=https://example.com&checks=seo,performance"
    ```

### 3. `GET /audit/check`

Checks if a URL is accessible and returns SSL and DNS information.

-   **URL**: `/audit/check?url={website_url}`
-   **Example**:
    ```bash
    curl "http://localhost:3000/audit/check?url=https://example.com"
    ```

### 4. `GET /health`

Checks if the API and its dependencies are running properly.

-   **URL**: `/health`
-   **Example**:
    ```bash
    curl http://localhost:3000/health
    ```

## License

MIT License
