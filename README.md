# Hono Website Audit API

A comprehensive website auditing API built with Hono.js that analyzes webpages and returns detailed audit data including SEO metrics, performance data, content analysis, and resource information.

## Features

- 🔍 **SEO Analysis** - Extract titles, meta descriptions, Open Graph tags
- ⚡ **Performance Metrics** - Measure page load times
- 📄 **Content Analysis** - Parse headings, images, and page structure
- 🔗 **Resource Detection** - Analyze links, scripts, and stylesheets
- 🎯 **Structured Data** - Extract JSON-LD structured data
- 🛡️ **Error Handling** - Comprehensive error handling with proper HTTP status codes

## Tech Stack

- **Framework**: Hono.js
- **Browser Automation**: Puppeteer
- **HTML Parsing**: Cheerio
- **Language**: TypeScript
- **Validation**: Zod

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

1. Clone the repository (if you haven't already)
2. Install dependencies:
   ```bash
   npm install
   ```

### Building the Project

Before running the API, you need to build the TypeScript code:

```bash
npm run build
```

This will compile the TypeScript code into JavaScript and place it in the `dist/` directory.

### Starting the Server

You can start the server in two ways:

#### Production Mode
```bash
npm start
```

This runs the compiled JavaScript code from the `dist/` directory.

#### Development Mode
```bash
npm run dev
```

This runs the TypeScript code directly and watches for changes, automatically restarting the server when files are modified.

The API will be available at `http://localhost:3000` by default.

## API Endpoints

### 1. Main Audit Endpoint
```
GET /audit?url={website_url}
```

Performs a comprehensive audit of the specified website.

**Example:**
```
GET http://localhost:3000/audit?url=https://example.com
```

### 2. Quick Audit Endpoint
```
GET /audit/quick?url={website_url}
```

Performs a faster audit with limited data.

**Example:**
```
GET http://localhost:3000/audit/quick?url=https://example.com
```

### 3. URL Accessibility Check
```
GET /audit/check?url={website_url}
```

Checks if a URL is accessible without performing a full audit.

**Example:**
```
GET http://localhost:3000/audit/check?url=https://example.com
```

### 4. Health Check
```
GET /health
```

Checks if the API is running properly.

**Example:**
```
GET http://localhost:3000/health
```

### 5. Browser Info
```
GET /browser/info
```

Gets information about the browser instance used for auditing.

**Example:**
```
GET http://localhost:3000/browser/info
```

## Usage Examples

### Auditing a Website

To audit a website, make a GET request to the `/audit` endpoint with a URL parameter:

```bash
# Using curl
curl "http://localhost:3000/audit?url=https://example.com"

# Using wget
wget "http://localhost:3000/audit?url=https://example.com" -qO-
```

### Auditing with a Real Example

Let's audit the Mozilla Developer Network website:

```bash
curl "http://localhost:3000/audit?url=https://developer.mozilla.org"
```

### Quick Audit for Faster Results

For a faster audit with limited data:

```bash
curl "http://localhost:3000/audit/quick?url=https://github.com"
```

### Checking URL Accessibility

To simply check if a URL is accessible:

```bash
curl "http://localhost:3000/audit/check?url=https://stackoverflow.com"
```

## API Response Structure

The main audit endpoint returns a comprehensive audit result with the following structure:

```typescript
{
  url: string;
  statusCode: number;
  metadata: PageMetadata;
  performance: PerformanceMetrics;
  seo: SeoDetails;
  content: ContentDetails;
  resources: PageResources;
  structuredData: any[];
}
```

Each section contains specific information about the audited website:

- **metadata**: Page language, charset, favicon, viewport
- **performance**: Page load time metrics
- **seo**: Title, description, meta tags, Open Graph tags
- **content**: Headings (H1-H6), images with alt text
- **resources**: Links, scripts, stylesheets
- **structuredData**: JSON-LD structured data

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid URL)
- `500` - Internal Server Error

All errors are returned in JSON format with descriptive messages.

## Development Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run type-check` - Run TypeScript type checking
- `npm run clean` - Clean build directory

## Common Issues and Solutions

### Puppeteer Download Issues

If you encounter issues with Puppeteer downloading Chromium during installation:

```bash
# Set environment variable to skip download
PUPPETEER_SKIP_DOWNLOAD=1 npm install

# Or use an existing Chrome installation
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npm install
```

### Port Conflicts

To run the server on a different port:

```bash
PORT=8080 npm start
```

Or on Windows:
```cmd
set PORT=8080 && npm start
```

## Testing the API

Once the server is running, you can test it with these example commands:

```bash
# Health check
curl http://localhost:3000/health

# Audit a simple website
curl "http://localhost:3000/audit?url=https://example.com"

# Quick audit
curl "http://localhost:3000/audit/quick?url=https://example.com"

# Check accessibility
curl "http://localhost:3000/audit/check?url=https://example.com"
```

## License

MIT License