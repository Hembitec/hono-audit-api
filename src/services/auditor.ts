import { WebsiteAuditResult, AuditOptions, ApiError, PageResources, AccessibilityAudit, CoreWebVitals, SecurityAudit, Technology } from '../types/interfaces.js';
import { validateUrl, ValidationResult } from './validator.js';
import { getBrowserService, PageLoadResult } from './browser.js';
import { createHtmlParser, PageStatistics } from './parser.js';
import { measureExecutionTime, retryWithBackoff } from '../utils/helpers.js';
import { run } from 'axe-core';
import Wappalyzer from 'wappalyzer-core';
import { promises as dns } from 'dns';
import * as tls from 'tls';
import { Page } from 'playwright';
import * as fs from 'fs';

/**
 * Main audit service that orchestrates all components
 * Coordinates URL validation, page loading, and HTML parsing
 */
export class WebsiteAuditor {
  private browserService = getBrowserService();
  private wappalyzer: Wappalyzer;
  private axeScript: string;

  constructor() {
    this.wappalyzer = new Wappalyzer();
    this.axeScript = fs.readFileSync('node_modules/axe-core/axe.min.js', 'utf-8');
  }

  /**
   * Perform a complete website audit
   * @param url - URL to audit
   * @param options - Audit options
   * @returns Complete audit result or error
   */
  async auditWebsite(url: string, options: AuditOptions = {}): Promise<AuditResult> {
    const startTime = Date.now();
    let validationResult: ValidationResult;
    let page: Page | undefined;

    try {
      // Step 1: Validate URL
      console.log(`🔍 Starting audit for: ${url}`);
      validationResult = validateUrl(url);
      
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error!,
          executionTime: Date.now() - startTime,
        };
      }

      const validatedUrl = validationResult.url!;
      console.log(`✅ URL validated: ${validatedUrl}`);

      // Step 2: Load page with browser automation
      console.log(`🌐 Loading page with browser automation...`);
      const { result: loadResult, executionTime: loadTime } = await measureExecutionTime(
        () => this.loadPageWithRetry(validatedUrl, options)
      );

      
      if (!loadResult.success) {
        return {
          success: false,
          error: loadResult.error!,
          executionTime: Date.now() - startTime,
          details: {
            step: 'page_loading',
            loadTime,
          }
        };
      }

      page = loadResult.page;

      console.log(`✅ Page loaded successfully (${loadTime}ms)`);
      console.log(`📊 Status: ${loadResult.statusCode}, Load time: ${loadResult.loadTimeInMs}ms`);

      // Step 3: Parse HTML and extract data
      console.log(`📝 Parsing HTML content...`);
      const { result: parseResult, executionTime: parseTime } = await measureExecutionTime(
        () => this.parseHtmlContent(loadResult.html!, loadResult.url)
      );

      console.log(`✅ HTML parsed successfully (${parseTime}ms)`);

      // Step 4: Construct complete audit result
      // Remove 'scripts' from resources and add response info with headers and loadTime
      const { scripts, ...rest } = parseResult.resources;
      const modifiedResources: PageResources = { ...rest, scripts: [] };

      const auditResult: WebsiteAuditResult & { response?: { headers: Record<string, string>, loadTimeInMs: number } } = {
        ...parseResult,
        url: loadResult.url, // Use final URL (after redirects)
        statusCode: loadResult.statusCode!,
        performance: {
          loadTimeInMs: loadResult.loadTimeInMs || 0,
        },
        resources: modifiedResources,
        response: {
          headers: loadResult.headers!,
          loadTimeInMs: loadResult.loadTimeInMs || 0,
        }
      };

      // Step 5: Perform accessibility audit
      if (page) {
        console.log('♿ Performing accessibility audit...');
        const accessibilityResult = await this.runAccessibilityAudit(page);
        auditResult.accessibility = accessibilityResult;
        console.log(`✅ Accessibility audit completed with ${accessibilityResult.violations.length} violations.`);

        console.log('🚀 Measuring Core Web Vitals...');
        const coreWebVitals = await this.measureCoreWebVitals(page);
        auditResult.performance.coreWebVitals = coreWebVitals;
        console.log('✅ Core Web Vitals measured.');
      }

      // Step 6: Analyze security headers
      if (loadResult.headers) {
        console.log('🔒 Analyzing security headers...');
        const securityAudit = this.analyzeSecurityHeaders(loadResult.headers);
        auditResult.security = securityAudit;
        console.log('✅ Security headers analyzed.');
      }

      // Step 7: Detect technology stack
      console.log('💻 Detecting technology stack...');
      const technologies = await this.detectTechnologies(loadResult.url, loadResult.html!, loadResult.headers!);
      auditResult.technologies = technologies;
      console.log(`✅ Detected ${technologies.length} technologies.`);

      // Optionally capture screenshot(s)
      if (options.includeScreenshot) {
        try {
          const shotOpts: any = {};
          if (options.screenshotType) shotOpts.type = options.screenshotType;
          if (typeof options.screenshotQuality === 'number') shotOpts.quality = options.screenshotQuality;
          const shots = await this.browserService.screenshotUrl(loadResult.url, shotOpts);
          // attach screenshot(s) to audit result
          auditResult.screenshot = Array.isArray(shots) ? shots : [shots];
        } catch (shotErr) {
          auditResult.screenshot = [];
          (auditResult as any).screenshotError = String(shotErr instanceof Error ? shotErr.message : shotErr);
        }
      }

      const totalExecutionTime = Date.now() - startTime;
      console.log(`🎉 Audit completed successfully (${totalExecutionTime}ms total)`);

      const parser = createHtmlParser(loadResult.html!, loadResult.url);
      const statistics = parser.getPageStatistics();

      return {
        success: true,
        data: auditResult,
        executionTime: totalExecutionTime,
        details: {
          loadTime,
          parseTime,
          totalElements: statistics.totalElements,
        }
      };

    } catch (error) {
      const errorResult: AuditResult = {
        success: false,
        error: {
          error: 'AUDIT_FAILED',
          message: `Audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: {
            step: 'unknown',
            originalError: error instanceof Error ? error.name : 'UnknownError',
          }
        },
        executionTime: Date.now() - startTime,
      };

      console.error('❌ Audit failed:', error);
      return errorResult;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Run accessibility audit on the page
   * @param page - Playwright page instance
   * @returns Accessibility audit results
   */
  private async runAccessibilityAudit(page: Page): Promise<AccessibilityAudit> {
    try {
      await page.evaluate(this.axeScript);
      const axeResults = await page.evaluate(() => (window as any).axe.run({
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        },
      }));

      const violationSummary = {
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 0,
      };

      axeResults.violations.forEach((v: any) => {
        if (v.impact) violationSummary[v.impact]++;
      });

      return {
        violations: axeResults.violations,
        violationSummary,
      };
    } catch (error) {
      console.warn('♿ Accessibility audit failed:', error);
      return {
        violations: [],
        violationSummary: { critical: 0, serious: 0, moderate: 0, minor: 0 },
      };
    }
  }

  /**
   * Measure Core Web Vitals for the page
   * @param page - Playwright page instance
   * @returns Core Web Vitals metrics
   */
  private async measureCoreWebVitals(page: any): Promise<CoreWebVitals> {
    try {
      const metrics = await page.evaluate(() => {
        return new Promise<CoreWebVitals>((resolve) => {
          let lcp = -1, fid = -1, cls = -1;

          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            lcp = lastEntry.renderTime || lastEntry.loadTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });

          new PerformanceObserver((entryList) => {
            const firstInput = entryList.getEntries()[0] as any;
            fid = firstInput.processingStart - firstInput.startTime;
          }).observe({ type: 'first-input', buffered: true });

          let cumulativeCls = 0;
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries() as any[];
            entries.forEach(e => cumulativeCls += e.value);
            cls = cumulativeCls;
          }).observe({ type: 'layout-shift', buffered: true });

          // Resolve after a short delay to allow metrics to be collected
          setTimeout(() => resolve({ lcp, fid, cls }), 3000);
        });
      });
      return metrics;
    } catch (error) {
      console.warn('🚀 Core Web Vitals measurement failed:', error);
      return { lcp: -1, fid: -1, cls: -1 };
    }
  }

  /**
   * Analyze security headers from the response
   * @param headers - HTTP response headers
   * @returns Security audit results
   */
  private analyzeSecurityHeaders(headers: Record<string, string>): SecurityAudit {
    const securityHeaders = [
      'content-security-policy',
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
    ];

    const results = securityHeaders.map(name => {
      const value = headers[name];
      return {
        name,
        value,
        present: value !== undefined,
      };
    });

    return { headers: results };
  }

  /**
   * Detect technology stack using Wappalyzer
   * @param url - The URL of the page
   * @param html - The HTML content of the page
   * @param headers - The HTTP response headers
   * @returns A list of detected technologies
   */
  private async detectTechnologies(url: string, html: string, headers: Record<string, string>): Promise<Technology[]> {
    try {
      await this.wappalyzer.init();
      const site = await this.wappalyzer.open(url, headers);
      const results = await site.analyze();
      return results.technologies;
    } catch (error) {
      console.warn('💻 Technology detection failed:', error);
      return [];
    }
  }

  /**
   * Load page with retry logic
   * @param url - URL to load
   * @param options - Audit options
   * @returns Page load result
   */
  private async loadPageWithRetry(url: string, options: AuditOptions): Promise<PageLoadResult> {
    return retryWithBackoff(
      async () => {
        const result = await this.browserService.loadPage(url, options);
        
        // If page loading failed, throw error to trigger retry
        if (!result.success) {
          throw new Error(result.error?.message || 'Page loading failed');
        }
        
        return result;
      },
      2, // max retries
      1000 // base delay
    );
  }

  /**
   * Parse HTML content and extract all audit data
   * @param html - HTML content
   * @param url - Page URL
   * @returns Parsed audit data
   */
  private async parseHtmlContent(html: string, url: string): Promise<Omit<WebsiteAuditResult, 'performance'>> {
    const parser = createHtmlParser(html, url);
    const auditData = parser.extractAuditData(200); // Status code will be overridden
    
    // Add additional analysis
    const statistics = parser.getPageStatistics();
    console.log(`📈 Page statistics:`, {
      totalElements: statistics.totalElements,
      images: statistics.totalImages,
      links: statistics.totalLinks,
      scripts: statistics.totalScripts,
      headings: statistics.totalHeadings,
      words: statistics.wordCount,
    });

    return auditData;
  }

  /**
   * Perform a quick audit with basic information only
   * @param url - URL to audit
   * @param options - Audit options
   * @returns Quick audit result
   */
  async quickAudit(url: string, options: AuditOptions = {}): Promise<QuickAuditResult> {
    const startTime = Date.now();
    let page: Page | undefined;

    try {
      // Validate URL
      const validationResult = validateUrl(url);
      if (!validationResult.success) {
        return {
          success: false,
          error: validationResult.error!,
          executionTime: Date.now() - startTime,
        };
      }

      // Load page (with shorter timeout for quick audit)
      const quickOptions = {
        ...options,
        timeout: options.timeout || 10000, // 10 second timeout
      };

      const pageResult = await this.browserService.loadPage(validationResult.url!, quickOptions);
      
      if (!pageResult.success) {
        return {
          success: false,
          error: pageResult.error!,
          executionTime: Date.now() - startTime,
        };
      }

      page = pageResult.page;

      const checks = options.checks || ['seo', 'performance'];
      const data: any = {
        url: pageResult.url,
        statusCode: pageResult.statusCode!,
      };

      if (checks.includes('seo')) {
        const parser = createHtmlParser(pageResult.html!, pageResult.url);
        const auditData = parser.extractAuditData(pageResult.statusCode!);
        data.title = auditData.seo.title;
        data.description = auditData.seo.description;
        data.metadata = auditData.metadata;
      }

      if (checks.includes('performance')) {
        data.loadTimeInMs = pageResult.loadTimeInMs || 0;
      }

      if (checks.includes('statistics')) {
        const parser = createHtmlParser(pageResult.html!, pageResult.url);
        data.statistics = parser.getPageStatistics();
      }

      return {
        success: true,
        data,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        error: {
          error: 'QUICK_AUDIT_FAILED',
          message: `Quick audit failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
        executionTime: Date.now() - startTime,
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Check if a URL is accessible
   * @param url - URL to check
   * @returns Accessibility result
   */
  async checkUrlAccessibility(url: string): Promise<AccessibilityResult> {
    const startTime = Date.now();
    let page: Page | undefined;

    try {
      // Validate URL format
      const validationResult = validateUrl(url);
      if (!validationResult.success) {
        return {
          accessible: false,
          error: validationResult.error!.message,
          executionTime: Date.now() - startTime,
        };
      }

      const validatedUrl = validationResult.url!;
      const hostname = new URL(validatedUrl).hostname;

      const [dnsInfo, sslInfo] = await Promise.all([
        this.getDnsInfo(hostname),
        this.getSslInfo(hostname),
      ]);

      // Try to load the page with minimal timeout
      const pageResult = await this.browserService.loadPage(validatedUrl, {
        timeout: 5000, // 5 second timeout
      });

      page = pageResult.page;

      const result: AccessibilityResult = {
        accessible: pageResult.success,
        finalUrl: pageResult.url,
        executionTime: Date.now() - startTime,
        dns: dnsInfo,
        ssl: sslInfo,
      };
      
      if (pageResult.statusCode !== undefined) result.statusCode = pageResult.statusCode;
      if (!pageResult.success && pageResult.error?.message) result.error = pageResult.error.message;
      if (pageResult.loadTimeInMs !== undefined) result.loadTimeInMs = pageResult.loadTimeInMs;
      
      return result;

    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime,
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private async getDnsInfo(hostname: string): Promise<DnsInfo> {
    try {
      const ipAddress = await dns.lookup(hostname);
      return { ipAddress: ipAddress.address };
    } catch (error) {
      return { error: (error as Error).message };
    }
  }

  private getSslInfo(hostname: string): Promise<SslInfo> {
    return new Promise((resolve) => {
      let resolved = false;
      const socket = tls.connect(443, hostname, { servername: hostname }, () => {
        if (resolved) return;
        resolved = true;
        const cert = socket.getPeerCertificate();
        socket.destroy();
        resolve({
          valid: true,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          issuer: cert.issuer.O,
        });
      });

      socket.on('error', (error) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve({ valid: false, error: error.message });
      });

      socket.setTimeout(2000, () => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        resolve({ valid: false, error: 'Timeout' });
      });

      socket.on('close', () => {
        if (resolved) return;
        resolved = true;
        resolve({ valid: false, error: 'Socket closed without connection' });
      });
    });
  }

  /**
   * Get browser information
   * @returns Browser version and status
   */
  async getBrowserInfo(): Promise<BrowserInfo> {
    try {
      const version = await this.browserService.getVersion();
      const isReady = this.browserService.isReady();

      return {
        version,
        isReady,
        status: isReady ? 'ready' : 'initializing',
      };
    } catch (error) {
      return {
        version: 'unknown',
        isReady: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.browserService.close();
      console.log('🧹 Browser service cleaned up');
    } catch (error) {
      console.warn('⚠️ Failed to cleanup browser service:', error);
    }
  }
}

/**
 * Main audit result interface
 */
export interface AuditResult {
  success: boolean;
  data?: WebsiteAuditResult;
  error?: ApiError;
  executionTime: number;
  details?: {
    step?: string;
    loadTime?: number;
    parseTime?: number;
    totalElements?: number;
    originalError?: string;
  };
}

/**
 * Quick audit result interface
 */
export interface QuickAuditResult {
  success: boolean;
  data?: {
    url: string;
    statusCode: number;
    title: string;
    description: string;
    loadTimeInMs: number;
    metadata: any;
    statistics: PageStatistics;
  };
  error?: ApiError;
  executionTime: number;
}

/**
 * URL accessibility result interface
 */
export interface AccessibilityResult {
  accessible: boolean;
  statusCode?: number;
  error?: string;
  loadTimeInMs?: number;
  finalUrl?: string;
  executionTime: number;
  ssl?: SslInfo;
  dns?: DnsInfo;
}

/**
 * SSL certificate information
 */
export interface SslInfo {
  valid: boolean;
  validFrom?: string;
  validTo?: string;
  issuer?: string;
  error?: string;
}

/**
 * DNS lookup information
 */
export interface DnsInfo {
  ipAddress?: string;
  error?: string;
}

/**
 * Browser information interface
 */
export interface BrowserInfo {
  version: string;
  isReady: boolean;
  status: 'ready' | 'initializing' | 'error';
  error?: string;
}

// Singleton instance
let auditorInstance: WebsiteAuditor | null = null;

/**
 * Get the singleton website auditor instance
 * @returns Website auditor instance
 */
export function getWebsiteAuditor(): WebsiteAuditor {
  if (!auditorInstance) {
    auditorInstance = new WebsiteAuditor();
  }
  return auditorInstance;
}

/**
 * Perform a website audit using the singleton instance
 * @param url - URL to audit
 * @param options - Audit options
 * @returns Audit result
 */
export async function auditWebsite(url: string, options: AuditOptions = {}): Promise<AuditResult> {
  const auditor = getWebsiteAuditor();
  return auditor.auditWebsite(url, options);
}

/**
 * Perform a quick audit using the singleton instance
 * @param url - URL to audit
 * @param options - Audit options
 * @returns Quick audit result
 */
export async function quickAuditWebsite(url: string, options: AuditOptions = {}): Promise<QuickAuditResult> {
  const auditor = getWebsiteAuditor();
  return auditor.quickAudit(url, options);
}

/**
 * Check URL accessibility using the singleton instance
 * @param url - URL to check
 * @returns Accessibility result
 */
export async function checkWebsiteAccessibility(url: string): Promise<AccessibilityResult> {
  const auditor = getWebsiteAuditor();
  return auditor.checkUrlAccessibility(url);
}
