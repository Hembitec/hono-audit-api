import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { cors } from 'hono/cors';
import {
  getWebsiteAuditor,
  auditWebsite,
  quickAuditWebsite,
  checkWebsiteAccessibility
} from './services/auditor.js';
import { validateUrl } from './services/validator.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Create Hono app
const app = new Hono();

// Middleware
app.use(logger());
app.use(prettyJSON());
app.use(cors());

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Website Audit API'
  });
});

// Serve static UI files
function serveStatic(filename: string) {
  try {
    const filePath = join(process.cwd(), 'public', filename);
    const content = readFileSync(filePath, { encoding: 'utf8' });
    return content;
  } catch {
    return null;
  }
}

app.get('/', (c) => {
  const html = serveStatic('index.html');
  if (!html) return c.text('UI not found', 404);
  return c.html(html);
});

app.get('/styles.css', (c) => {
  const css = serveStatic('styles.css');
  if (!css) return c.text('Not found', 404);
  return c.body(css, 200, { 'Content-Type': 'text/css' });
});

app.get('/app.js', (c) => {
  const js = serveStatic('app.js');
  if (!js) return c.text('Not found', 404);
  return c.body(js, 200, { 'Content-Type': 'application/javascript' });
});

// Serve screenshots saved by the auditor
app.get('/screenshots/:name', (c) => {
  const name = c.req.param('name');
  const filePath = join(process.cwd(), 'public', 'screenshots', name);
  try {
    const data = readFileSync(filePath);
    const contentType = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return c.body(data, 200, { 'Content-Type': contentType });
  } catch (e) {
    return c.text('Not found', 404);
  }
});

// Main audit endpoint
app.get('/audit', async (c) => {
  try {
    const url = c.req.query('url');
    const includeScreenshot = String(c.req.query('includeScreenshot') || '').toLowerCase() === 'true';
    const screenshotType = String(c.req.query('screenshotType') || 'jpeg') as 'jpeg' | 'png';
    const screenshotQuality = Number(c.req.query('screenshotQuality') || 80);

    // Validate URL parameter
    if (!url) {
      return c.json({
        error: 'MISSING_URL',
        message: 'URL parameter is required'
      }, 400);
    }

    // Use the existing validation logic
    const validationResult = validateUrl(url);
    if (!validationResult.success) {
      return c.json({
        error: validationResult.error?.error || 'INVALID_URL',
        message: validationResult.error?.message || 'Invalid URL provided'
      }, 400);
    }

    // Perform the audit using the existing service (use validated URL and pass options)
    const validatedUrl = validationResult.url!;
    const auditResult = await auditWebsite(validatedUrl, { includeScreenshot, screenshotType, screenshotQuality });

    if (!auditResult.success) {
      return c.json({
        error: auditResult.error?.error || 'AUDIT_FAILED',
        message: auditResult.error?.message || 'Failed to audit website'
      }, 500);
    }

    // Return the audit result
    return c.json(auditResult.data);

  } catch (error) {
    console.error('Unexpected error in audit endpoint:', error);
    return c.json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }, 500);
  }
});

// Quick audit endpoint (faster, limited data)
app.get('/audit/quick', async (c) => {
  try {
    const url = c.req.query('url');

    // Validate URL parameter
    if (!url) {
      return c.json({
        error: 'MISSING_URL',
        message: 'URL parameter is required'
      }, 400);
    }

    // Use the existing validation logic
    const validationResult = validateUrl(url);
    if (!validationResult.success) {
      return c.json({
        error: validationResult.error?.error || 'INVALID_URL',
        message: validationResult.error?.message || 'Invalid URL provided'
      }, 400);
    }

    // Perform quick audit
    const auditResult = await quickAuditWebsite(url);

    if (!auditResult.success) {
      return c.json({
        error: auditResult.error?.error || 'QUICK_AUDIT_FAILED',
        message: auditResult.error?.message || 'Failed to perform quick audit'
      }, 500);
    }

    return c.json(auditResult.data);

  } catch (error) {
    console.error('Unexpected error in quick audit endpoint:', error);
    return c.json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }, 500);
  }
});

// URL accessibility check endpoint
app.get('/audit/check', async (c) => {
  try {
    const url = c.req.query('url');

    // Validate URL parameter
    if (!url) {
      return c.json({
        error: 'MISSING_URL',
        message: 'URL parameter is required'
      }, 400);
    }

    // Check accessibility
    const result = await checkWebsiteAccessibility(url);

    return c.json(result);

  } catch (error) {
    console.error('Unexpected error in accessibility check endpoint:', error);
    return c.json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }, 500);
  }
});

// Get browser info endpoint
app.get('/browser/info', async (c) => {
  try {
    const auditor = getWebsiteAuditor();
    const info = await auditor.getBrowserInfo();
    return c.json(info);
  } catch (error) {
    console.error('Error getting browser info:', error);
    return c.json({
      error: 'BROWSER_INFO_FAILED',
      message: 'Failed to get browser information'
    }, 500);
  }
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found'
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'INTERNAL_ERROR',
    message: 'An internal server error occurred'
  }, 500);
});

// Export for use with Node.js server adapter
export default app;

// Start server when run directly
if (process.argv[1] && process.argv[1].includes('index.ts')) {
  const port = parseInt(process.env.PORT || '3000');
  // Import the Node.js server adapter
  import('@hono/node-server').then(({ serve }) => {
    serve({
      fetch: app.fetch,
      port
    }, (info) => {
      console.log(`🚀 Server is running on port ${info.port}`);
      console.log(`📄 Audit endpoint: http://localhost:${info.port}/audit?url=https://example.com`);
    });
  }).catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}