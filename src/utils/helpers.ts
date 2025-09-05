/**
 * Utility helper functions for the website audit API
 */

/**
 * Safely parse JSON with error handling
 * @param jsonString - JSON string to parse
 * @returns Parsed object or null if parsing fails
 */
export function safeJsonParse(jsonString: string): any | null {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Clean and normalize text content
 * @param text - Raw text content
 * @returns Cleaned text
 */
export function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
    .trim();
}

/**
 * Convert relative URL to absolute URL
 * @param relativeUrl - Relative URL
 * @param baseUrl - Base URL to resolve against
 * @returns Absolute URL or original URL if already absolute
 */
export function resolveUrl(relativeUrl: string, baseUrl: string): string {
  try {
    return new URL(relativeUrl, baseUrl).toString();
  } catch {
    // If URL construction fails, return the original URL
    return relativeUrl;
  }
}

/**
 * Extract text content from HTML while preserving structure
 * @param html - HTML content
 * @returns Plain text content
 */
export function extractTextFromHtml(html: string): string {
  // Simple HTML tag removal - in real implementation you might use a library
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Truncate text to a maximum length
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add if truncated
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Check if a string is a valid URL
 * @param str - String to check
 * @returns True if string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the domain from a URL
 * @param url - URL string
 * @returns Domain name or null if invalid
 */
export function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is internal (same domain)
 * @param url - URL to check
 * @param baseUrl - Base URL to compare against
 * @returns True if URL is internal
 */
export function isInternalUrl(url: string, baseUrl: string): boolean {
  try {
    const urlDomain = new URL(url, baseUrl).hostname;
    const baseDomain = new URL(baseUrl).hostname;
    return urlDomain === baseDomain;
  } catch {
    return false;
  }
}

/**
 * Sanitize filename for safe file operations
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_') // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .toLowerCase();
}

/**
 * Generate a unique identifier
 * @returns Unique identifier string
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

/**
 * Measure execution time of an async function
 * @param fn - Function to measure
 * @returns Object with result and execution time
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; executionTime: number }> {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const executionTime = Number((end - start) / BigInt(1000000)); // Convert to milliseconds
  
  return { result, executionTime };
}

/**
 * Retry an async operation with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Promise that resolves with the result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Deep clone an object
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  
  return obj;
}

/**
 * Debounce function to limit function calls
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(null, args), delay);
  };
}

/**
 * Throttle function to limit function execution rate
 * @param fn - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
