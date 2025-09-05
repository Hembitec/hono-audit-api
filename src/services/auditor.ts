import { WebsiteAuditResult, AuditOptions, ApiError, PageResources } from '../types/interfaces.js';
import { validateUrl, ValidationResult } from './validator.js';
import { getBrowserService, PageLoadResult } from './browser.js';
import { createHtmlParser, PageStatistics } from './parser.js';
import { measureExecutionTime, retryWithBackoff } from '../utils/helpers.js';

/**
 * Main audit service that orchestrates all components
 * Coordinates URL validation, page loading, and HTML parsing
 */
export class WebsiteAuditor {
  private browserService = getBrowserService();

  /**
   * Perform a complete website audit
   * @param url - URL to audit
   * @param options - Audit options
   * @returns Complete audit result or error
   */
  async auditWebsite(url: string, options: AuditOptions = {}): Promise<AuditResult> {
    const startTime = Date.now();
    let validationResult: ValidationResult;
    let pageLoadResult: PageLoadResult;

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

      pageLoadResult = loadResult;
      
      if (!pageLoadResult.success) {
        return {
          success: false,
          error: pageLoadResult.error!,
          executionTime: Date.now() - startTime,
          details: {
            step: 'page_loading',
            loadTime,
          }
        };
      }

      console.log(`✅ Page loaded successfully (${loadTime}ms)`);
      console.log(`📊 Status: ${pageLoadResult.statusCode}, Load time: ${pageLoadResult.loadTimeInMs}ms`);

      // Step 3: Parse HTML and extract data
      console.log(`📝 Parsing HTML content...`);
      const { result: parseResult, executionTime: parseTime } = await measureExecutionTime(
        () => this.parseHtmlContent(pageLoadResult.html!, pageLoadResult.url)
      );

      console.log(`✅ HTML parsed successfully (${parseTime}ms)`);

      // Step 4: Construct complete audit result
      // Remove 'scripts' from resources and add response info with headers and loadTime
      const { scripts, ...rest } = parseResult.resources;
      const modifiedResources: PageResources = { ...rest, scripts: [] };

      const auditResult: WebsiteAuditResult & { response?: { headers: Record<string, string>, loadTimeInMs: number } } = {
        ...parseResult,
        url: pageLoadResult.url, // Use final URL (after redirects)
        statusCode: pageLoadResult.statusCode!,
        performance: {
          loadTimeInMs: pageLoadResult.loadTimeInMs || 0,
        },
        resources: modifiedResources,
        response: {
          headers: pageLoadResult.headers!,
          loadTimeInMs: pageLoadResult.loadTimeInMs || 0,
        }
      };

      // Optionally capture screenshot(s)
      if (options.includeScreenshot) {
        try {
          const shotOpts: any = {};
          if (options.screenshotType) shotOpts.type = options.screenshotType;
          if (typeof options.screenshotQuality === 'number') shotOpts.quality = options.screenshotQuality;
          const shots = await this.browserService.screenshotUrl(pageLoadResult.url, shotOpts);
          // attach screenshot(s) to audit result
          auditResult.screenshot = Array.isArray(shots) ? shots : [shots];
        } catch (shotErr) {
          auditResult.screenshot = [];
          (auditResult as any).screenshotError = String(shotErr instanceof Error ? shotErr.message : shotErr);
        }
      }

      const totalExecutionTime = Date.now() - startTime;
      console.log(`🎉 Audit completed successfully (${totalExecutionTime}ms total)`);

      const parser = createHtmlParser(pageLoadResult.html!, pageLoadResult.url);
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

      // Quick parse - only essential information
      const parser = createHtmlParser(pageResult.html!, pageResult.url);
      const auditData = parser.extractAuditData(pageResult.statusCode!);
      const statistics = parser.getPageStatistics();

      return {
        success: true,
        data: {
          url: pageResult.url,
          statusCode: pageResult.statusCode!,
          title: auditData.seo.title,
          description: auditData.seo.description,
          loadTimeInMs: pageResult.loadTimeInMs || 0,
          metadata: auditData.metadata,
          statistics,
        },
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
    }
  }

  /**
   * Check if a URL is accessible
   * @param url - URL to check
   * @returns Accessibility result
   */
  async checkUrlAccessibility(url: string): Promise<AccessibilityResult> {
    const startTime = Date.now();

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

      // Try to load the page with minimal timeout
      const pageResult = await this.browserService.loadPage(validationResult.url!, {
        timeout: 5000, // 5 second timeout
      });

      const result: AccessibilityResult = {
        accessible: pageResult.success,
        finalUrl: pageResult.url,
        executionTime: Date.now() - startTime,
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
    }
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
