import puppeteer, { Browser, Page, PuppeteerLaunchOptions, ScreenshotOptions } from 'puppeteer';
import { AuditOptions, ApiError } from '../types/interfaces.js';
import fs from 'fs';
import path from 'path';

/**
 * Browser automation service for loading and analyzing web pages
 * Handles browser lifecycle, performance measurement, and error recovery
 */
export class BrowserService {
  private browser: Browser | null = null;
  private isInitialized = false;
  // Concurrency control for pages/screenshots
  private maxConcurrentPages = Number(process.env.MAX_CONCURRENT_PAGES) || 2;
  private currentSlots = 0;
  private queue: Array<() => void> = [];
  // Screenshot cleanup
  private cleanupIntervalHandle: NodeJS.Timeout | null = null;
  private screenshotTTL = Number(process.env.SCREENSHOT_TTL_MS) || 30 * 60 * 1000; // default 30 minutes

  /**
   * Initialize the browser instance with optimized settings
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.browser) {
      return;
    }

    try {
      const launchOptions: PuppeteerLaunchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
        ],
        // Optimize for server environments
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
        // Timeout for browser launch
        timeout: 30000,
      };

      this.browser = await puppeteer.launch(launchOptions);
      this.isInitialized = true;

      // Handle browser disconnect
      this.browser.on('disconnected', () => {
        this.isInitialized = false;
        this.browser = null;
      });

      // Start periodic cleanup of screenshots (TTL)
      if (!this.cleanupIntervalHandle) {
        // Run cleanup every 5 minutes
        const interval = Math.max(60 * 1000, Math.floor(this.screenshotTTL / 6));
        this.cleanupIntervalHandle = setInterval(() => {
          this.cleanupScreenshots().catch(err => console.warn('cleanupScreenshots failed:', err));
        }, interval);
        console.log('BrowserService: started screenshot cleanup (TTL ms):', this.screenshotTTL, 'interval ms:', interval);
      }

    } catch (error) {
      throw new Error(`Failed to initialize browser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Acquire a concurrency slot (simple semaphore). Waits until a slot is available.
   */
  private acquireSlot(): Promise<void> {
    return new Promise((resolve) => {
      if (this.currentSlots < this.maxConcurrentPages) {
        this.currentSlots += 1;
        return resolve();
      }

      // otherwise queue
      this.queue.push(() => {
        this.currentSlots += 1;
        resolve();
      });
    });
  }

  /**
   * Release a previously acquired slot and run next queued task if any
   */
  private releaseSlot(): void {
    this.currentSlots = Math.max(0, this.currentSlots - 1);
    const next = this.queue.shift();
    if (next) {
      // run next queued resolver
      next();
    }
  }

  /**
   * Load a webpage and return page content with performance metrics
   * @param url - The URL to load
   * @param options - Audit options for customization
   * @returns Page analysis result
   */
  async loadPage(url: string, options: AuditOptions = {}): Promise<PageLoadResult> {
  await this.initialize();
  await this.acquireSlot();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    let page: Page | null = null;
    const startTime = Date.now();

    try {
      // Create a new page
      page = await this.browser.newPage();

      // Configure page settings
      await this.configurePage(page, options);

      // Start performance measurement
      const performanceStart = process.hrtime.bigint();

      // Navigate to the page with timeout
      const response = await page.goto(url, {
        waitUntil: 'networkidle0', // Wait until there are no network requests for 500ms
        timeout: options.timeout || 30000,
      });

      // Use non-null assertion to get headers since response is expected to be non-null
      const headers = response!.headers();

      // Calculate load time
      const performanceEnd = process.hrtime.bigint();
      const loadTimeInMs = Number((performanceEnd - performanceStart) / BigInt(1000000));

      if (!response) {
        throw new Error('Failed to load page - no response received');
      }

      // Get the status code
      const statusCode = response.status();

      // Wait for additional dynamic content
      await this.waitForDynamicContent(page);

      // Get the HTML content after all dynamic loading
      const html = await page.content();

      // Get additional performance metrics
      const performanceMetrics = await this.getPerformanceMetrics(page);

      // Get page URL (in case of redirects)
      const finalUrl = page.url();

      const result: PageLoadResult = {
        success: true,
        url: finalUrl,
        html,
        statusCode,
        loadTimeInMs: Math.max(loadTimeInMs, performanceMetrics.domContentLoaded || 0),
        performanceMetrics,
        totalTime: Date.now() - startTime,
        headers, // added headers
      };

      return result;

    } catch (error) {
      const errorResult: PageLoadResult = {
        success: false,
        url,
        error: {
          error: 'PAGE_LOAD_FAILED',
          message: `Failed to load page: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
            timeout: options.timeout || 30000,
            totalTime: Date.now() - startTime,
          }
        }
      };

      return errorResult;

    } finally {
      // Always close the page to free up resources
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.warn('Failed to close page:', closeError);
        }
      }
      // release concurrency slot
      try {
        this.releaseSlot();
      } catch (e) {
        console.warn('releaseSlot error:', e);
      }
    }
  }

  /**
   * Configure page settings and event handlers
   * @param page - Puppeteer page instance
   * @param options - Audit options
   */
  private async configurePage(page: Page, options: AuditOptions): Promise<void> {
    // Set user agent if provided
    if (options.userAgent) {
      await page.setUserAgent(options.userAgent);
    } else {
      // Use a realistic user agent
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
    }

    // Set viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      
      // Block images, fonts, and other non-essential resources for faster loading
      if (['image', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Handle console messages and errors for debugging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.warn(`Page console error: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      console.warn(`Page error: ${error.message}`);
    });
  }

  /**
   * Wait for dynamic content to load
   * @param page - Puppeteer page instance
   */
  private async waitForDynamicContent(page: Page): Promise<void> {
    try {
      // Wait for common dynamic content indicators
      await Promise.race([
        // Wait for a reasonable amount of time for SPA content
        new Promise(resolve => setTimeout(resolve, 2000)),
        // Simple delay as fallback
        new Promise(resolve => setTimeout(resolve, 1000)),
      ]);

      // Additional wait for common frameworks
      await page.evaluate(() => {
        return new Promise<void>((resolve) => {
          // Wait for React/Vue/Angular to finish rendering
          if (typeof globalThis !== 'undefined' && typeof (globalThis as any).requestIdleCallback === 'function') {
            (globalThis as any).requestIdleCallback(resolve);
          } else {
            setTimeout(resolve, 100);
          }
        });
      });

    } catch (error) {
      // Don't fail the entire audit if dynamic content waiting fails
      console.warn('Failed to wait for dynamic content:', error);
    }
  }

  /**
   * Get performance metrics from the page
   * @param page - Puppeteer page instance
   * @returns Performance metrics object
   */
  private async getPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
    try {
      const metrics = await page.evaluate(() => {
        try {
          const entries = (performance as any).getEntriesByType('navigation');
          const navigation = entries[0] as any;
          
          if (!navigation) {
            return {
              domContentLoaded: 0,
              loadComplete: 0,
              firstPaint: 0,
              firstContentfulPaint: 0,
            };
          }
          
          return {
            domContentLoaded: (navigation.domContentLoadedEventEnd || 0) - (navigation.fetchStart || 0),
            loadComplete: (navigation.loadEventEnd || 0) - (navigation.fetchStart || 0),
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          };
        } catch {
          return {
            domContentLoaded: 0,
            loadComplete: 0,
            firstPaint: 0,
            firstContentfulPaint: 0,
          };
        }
      });

      return metrics;

    } catch (error) {
      console.warn('Failed to get performance metrics:', error);
      return {
        domContentLoaded: 0,
        loadComplete: 0,
        firstPaint: 0,
        firstContentfulPaint: 0,
      };
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.warn('Failed to close browser:', error);
      } finally {
        this.browser = null;
        this.isInitialized = false;
      }
    }
  }

  /**
   * Check if the browser is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.browser !== null;
  }

  /**
   * Get browser version information
   */
  async getVersion(): Promise<string> {
    await this.initialize();
    
    if (!this.browser) {
      return 'Browser not initialized';
    }

    return await this.browser.version();
  }

  /**
   * Capture screenshot(s) for the given URL. Returns an array (1 or 2 items) with metadata.
   */
  async screenshotUrl(url: string, opts: { type?: 'jpeg' | 'png'; quality?: number; maxHeight?: number } = {}) {
    await this.initialize();
    await this.acquireSlot();

    if (!this.browser) {
      this.releaseSlot();
      throw new Error('Browser not initialized');
    }

  const page = await this.browser.newPage();
    try {
      const type = opts.type || 'jpeg';
      const quality = opts.quality ?? 80;
      const MAX_SINGLE_IMAGE_HEIGHT = opts.maxHeight ?? 15000; // px

      console.log('screenshotUrl: navigating to', url);
      await page.setViewport({ width: 1280, height: 800 });
      const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.waitForDynamicContent(page);

      const dims = await page.evaluate(() => {
        const g = (globalThis as any);
        const el = g.document?.documentElement || { clientWidth: 0, scrollWidth: 0, clientHeight: 0, scrollHeight: 0 };
        return {
          width: Math.max(el.clientWidth || 0, el.scrollWidth || 0, g.window?.innerWidth || 0),
          height: Math.max(el.clientHeight || 0, el.scrollHeight || 0, g.window?.innerHeight || 0),
          dpr: g.window?.devicePixelRatio || 1,
        };
      });

      console.log('screenshotUrl: page dims', dims, 'MAX_SINGLE_IMAGE_HEIGHT', MAX_SINGLE_IMAGE_HEIGHT);

      const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
      await fs.promises.mkdir(screenshotsDir, { recursive: true });

      const safeName = url.replace(/(^\w+:|\/\/)|[^a-z0-9]/gi, '_').slice(0, 120);
      const timestamp = Date.now();
      const ext = type === 'jpeg' ? 'jpg' : 'png';

      const results: any[] = [];

      if (dims.height <= MAX_SINGLE_IMAGE_HEIGHT) {
        try {
          const screenshotOpts: any = { type, fullPage: true };
          if (type === 'jpeg' && typeof quality === 'number') screenshotOpts.quality = quality;
          const buffer = (await page.screenshot(screenshotOpts as ScreenshotOptions)) as unknown as Buffer;
          const filename = `${safeName}_${timestamp}.${ext}`;
          const filePath = path.join(screenshotsDir, filename);
          await fs.promises.writeFile(filePath, buffer);
          results.push({ filename, filePath, url: `/screenshots/${filename}`, base64: `data:image/${ext};base64,${buffer.toString('base64')}`, size: buffer.length, status: response?.status() ?? null, headers: response ? response.headers() : undefined });
          console.log('screenshotUrl: saved', filePath, 'size', buffer.length);
        } catch (err) {
          console.error('screenshotUrl: failed to capture/save single screenshot', err);
          throw err;
        }
      } else {
        const OVERLAP = 80;
        const half = Math.ceil(dims.height / 2);
        const topHeight = Math.min(half + OVERLAP, dims.height);
        const bottomStart = Math.max(half - OVERLAP, 0);
        const bottomHeight = dims.height - bottomStart;

        const parts = [ { y: 0, height: topHeight, suffix: 'part1' }, { y: bottomStart, height: bottomHeight, suffix: 'part2' } ];

        for (const part of parts) {
          try {
            const clip = { x: 0, y: Math.max(0, Math.floor(part.y)), width: Math.max(1, Math.floor(dims.width)), height: Math.max(1, Math.floor(part.height)) };
            const clipOpts: any = { type, clip };
            if (type === 'jpeg' && typeof quality === 'number') clipOpts.quality = quality;
            const buffer = (await page.screenshot(clipOpts as ScreenshotOptions)) as unknown as Buffer;
            const filename = `${safeName}_${timestamp}_${part.suffix}.${ext}`;
            const filePath = path.join(screenshotsDir, filename);
            await fs.promises.writeFile(filePath, buffer);
            results.push({ filename, filePath, url: `/screenshots/${filename}`, base64: `data:image/${ext};base64,${buffer.toString('base64')}`, size: buffer.length, status: response?.status() ?? null, headers: response ? response.headers() : undefined });
            console.log('screenshotUrl: saved part', filename, 'size', buffer.length);
          } catch (err) {
            console.error('screenshotUrl: failed to capture/save part', part, err);
            throw err;
          }
        }
      }

      return results;
    } finally {
      await page.close();
      try {
        this.releaseSlot();
      } catch (e) {
        console.warn('releaseSlot error after screenshot:', e);
      }
    }
  }

  /**
   * Remove screenshot files older than configured TTL
   */
  private async cleanupScreenshots(): Promise<void> {
    try {
      const screenshotsDir = path.join(process.cwd(), 'public', 'screenshots');
      const exists = await fs.promises.stat(screenshotsDir).then(s => s.isDirectory()).catch(() => false);
      if (!exists) return;

      const files = await fs.promises.readdir(screenshotsDir);
      const now = Date.now();
      const threshold = now - this.screenshotTTL;
      for (const file of files) {
        try {
          const fp = path.join(screenshotsDir, file);
          const st = await fs.promises.stat(fp);
          if (st.mtimeMs < threshold) {
            await fs.promises.unlink(fp);
            console.log('cleanupScreenshots: removed', fp);
          }
        } catch (err) {
          console.warn('cleanupScreenshots: failed for', file, err);
        }
      }
    } catch (err) {
      console.warn('cleanupScreenshots: unexpected error', err);
    }
  }
}

/**
 * Result of page loading operation
 */
export interface PageLoadResult {
  success: boolean;
  url: string;
  html?: string;
  statusCode?: number;
  loadTimeInMs?: number;
  performanceMetrics?: PerformanceMetrics;
  totalTime?: number;
  error?: ApiError;
  headers?: Record<string, string>; // added headers field
}

/**
 * Performance metrics collected from the page
 */
export interface PerformanceMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
}

// Singleton instance for reuse across requests
let browserServiceInstance: BrowserService | null = null;

/**
 * Get the singleton browser service instance
 * @returns Browser service instance
 */
export function getBrowserService(): BrowserService {
  if (!browserServiceInstance) {
    browserServiceInstance = new BrowserService();
  }
  return browserServiceInstance;
}

/**
 * Cleanup function to close browser on process exit
 */
export function setupBrowserCleanup(): void {
  const cleanup = async () => {
    if (browserServiceInstance) {
      await browserServiceInstance.close();
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);
}
