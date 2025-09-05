import { z } from 'zod';
import { ApiError } from '../types/interfaces.js';

/**
 * Zod schema for URL validation
 * Ensures the URL is a valid HTTP/HTTPS URL
 */
const urlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  },
  {
    message: 'URL must use HTTP or HTTPS protocol'
  }
);

/**
 * Validates if a URL string is properly formatted and accessible
 * @param urlString - The URL string to validate
 * @returns Validation result with success status and parsed URL or error
 */
export function validateUrl(urlString: string): ValidationResult {
  try {
    // First, check if the URL string is provided
    if (!urlString || urlString.trim() === '') {
      return {
        success: false,
        error: {
          error: 'MISSING_URL',
          message: 'URL parameter is required'
        }
      };
    }

    // Clean and normalize the URL
    const cleanUrl = urlString.trim();
    
    // Use Zod schema for initial validation
    const validationResult = urlSchema.safeParse(cleanUrl);
    
    if (!validationResult.success) {
      return {
        success: false,
        error: {
          error: 'INVALID_URL_FORMAT',
          message: 'Invalid URL format. Please provide a valid HTTP or HTTPS URL.',
          details: validationResult.error.issues
        }
      };
    }

    // Parse the URL for additional validation
    const parsedUrl = new URL(validationResult.data);
    
    // Check for valid hostname
    if (!parsedUrl.hostname || parsedUrl.hostname.trim() === '') {
      return {
        success: false,
        error: {
          error: 'INVALID_HOSTNAME',
          message: 'URL must have a valid hostname'
        }
      };
    }

    // Check for suspicious or blocked domains (basic security)
    if (isBlockedDomain(parsedUrl.hostname)) {
      return {
        success: false,
        error: {
          error: 'BLOCKED_DOMAIN',
          message: 'This domain is not allowed for auditing'
        }
      };
    }

    // Additional validations
    const validationErrors = performAdditionalValidations(parsedUrl);
    if (validationErrors.length > 0) {
      return {
        success: false,
        error: {
          error: 'URL_VALIDATION_FAILED',
          message: 'URL failed validation checks',
          details: validationErrors
        }
      };
    }

    return {
      success: true,
      url: parsedUrl.toString(),
      parsedUrl: parsedUrl
    };

  } catch (error) {
    return {
      success: false,
      error: {
        error: 'URL_PARSE_ERROR',
        message: 'Failed to parse the provided URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Validates multiple URLs at once
 * @param urls - Array of URL strings to validate
 * @returns Array of validation results
 */
export function validateUrls(urls: string[]): ValidationResult[] {
  return urls.map(url => validateUrl(url));
}

/**
 * Checks if a domain is in the blocked list
 * @param hostname - The hostname to check
 * @returns True if the domain should be blocked
 */
function isBlockedDomain(hostname: string): boolean {
  const blockedDomains: string[] = [
    // Add domains that should not be audited
    // 'malicious-site.com',
    // 'blocked-domain.net'
  ];
  
  const blockedPatterns: RegExp[] = [
    // Add patterns for domains that should be blocked
    // /.*\.internal$/,
    // /.*\.local$/
  ];

  // Check exact matches
  if (blockedDomains.includes(hostname.toLowerCase())) {
    return true;
  }

  // Check pattern matches
  return blockedPatterns.some(pattern => pattern.test(hostname.toLowerCase()));
}

/**
 * Performs additional URL validations beyond basic format checking
 * @param url - Parsed URL object
 * @returns Array of validation error messages
 */
function performAdditionalValidations(url: URL): string[] {
  const errors: string[] = [];

  // Check for reasonable URL length
  if (url.toString().length > 2048) {
    errors.push('URL is too long (maximum 2048 characters)');
  }

  // Check for valid port if specified
  if (url.port && url.port !== '') {
    const portNum = parseInt(url.port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      errors.push('Invalid port number');
    }
  }

  // Check for suspicious URL patterns
  if (url.pathname.includes('..') || url.pathname.includes('//')) {
    errors.push('URL contains suspicious path patterns');
  }

  // Check for data URLs or other non-HTTP protocols that might have slipped through
  if (!['http:', 'https:'].includes(url.protocol)) {
    errors.push('Only HTTP and HTTPS protocols are supported');
  }

  return errors;
}

/**
 * Normalizes a URL by cleaning up common issues
 * @param urlString - The URL string to normalize
 * @returns Normalized URL string
 */
export function normalizeUrl(urlString: string): string {
  let cleanUrl = urlString.trim();
  
  // Add protocol if missing
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`;
  }
  
  try {
    const url = new URL(cleanUrl);
    
    // Remove default ports
    if (
      (url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')
    ) {
      url.port = '';
    }
    
    // Normalize hostname to lowercase
    url.hostname = url.hostname.toLowerCase();
    
    // Remove trailing slash from pathname if it's just "/"
    if (url.pathname === '/' && !url.search && !url.hash) {
      // Keep the slash for root URLs
    }
    
    return url.toString();
  } catch {
    return cleanUrl;
  }
}

/**
 * Extracts domain from a URL
 * @param urlString - The URL string
 * @returns Domain name or null if invalid
 */
export function extractDomain(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Checks if two URLs are from the same domain
 * @param url1 - First URL
 * @param url2 - Second URL
 * @returns True if both URLs are from the same domain
 */
export function isSameDomain(url1: string, url2: string): boolean {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);
  
  if (!domain1 || !domain2) {
    return false;
  }
  
  return domain1.toLowerCase() === domain2.toLowerCase();
}

/**
 * Result of URL validation
 */
export interface ValidationResult {
  success: boolean;
  url?: string;
  parsedUrl?: URL;
  error?: ApiError;
}

/**
 * Configuration for URL validation
 */
export interface ValidationConfig {
  /** Maximum allowed URL length */
  maxUrlLength?: number;
  /** List of blocked domains */
  blockedDomains?: string[];
  /** List of allowed domains (if provided, only these domains are allowed) */
  allowedDomains?: string[];
  /** Whether to allow localhost URLs */
  allowLocalhost?: boolean;
}
