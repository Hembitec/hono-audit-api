/**
 * Main interface for the complete website audit result
 * Contains all data extracted from a webpage analysis
 */
export interface WebsiteAuditResult {
  /** The URL that was audited */
  url: string;
  /** HTTP status code returned by the webpage */
  statusCode: number;
  /** Page metadata information */
  metadata: PageMetadata;
  /** Performance metrics */
  performance: PerformanceMetrics;
  /** SEO-related data */
  seo: SeoDetails;
  /** Content structure analysis */
  content: ContentDetails;
  /** Page resources (links, scripts, styles) */
  resources: PageResources;
  /** Structured data found on the page */
  structuredData: any[];
  /** Formatted, LLM-friendly summary (optional) */
  formattedContent?: {
    headings: FormattedHeadings;
    links: FormattedLinks;
    resourceSizes: ResourceSizes;
  };
  /** Screenshot(s) captured for the page (optional) */
  screenshot?: ScreenshotInfo | ScreenshotInfo[];
}

/**
 * Basic page metadata extracted from HTML head
 */
export interface PageMetadata {
  /** Language attribute from html element */
  lang?: string;
  /** Character set declaration */
  charset?: string;
  /** Favicon URL */
  favicon?: string;
  /** Viewport meta tag content */
  viewport?: string;
}

/**
 * Performance-related metrics
 */
export interface PerformanceMetrics {
  /** Total page load time in milliseconds */
  loadTimeInMs: number;
}

/**
 * SEO-related information extracted from the page
 */
export interface SeoDetails {
  /** Page title */
  title: string;
  /** Meta description */
  description: string;
  /** All meta tags found */
  metaTags: MetaTag[];
  /** Canonical URL if specified */
  canonicalUrl?: string;
  /** Open Graph tags */
  ogTags: OgTag[];
}

/**
 * Individual meta tag information
 */
export interface MetaTag {
  /** Name attribute of meta tag */
  name?: string;
  /** Property attribute of meta tag */
  property?: string;
  /** Content of the meta tag */
  content: string;
}

/**
 * Open Graph tag information
 */
export interface OgTag {
  /** Property name (e.g., og:title) */
  property: string;
  /** Property content */
  content: string;
}

/**
 * Content structure analysis
 */
export interface ContentDetails {
  /** H1 headings */
  h1: Heading[];
  /** H2 headings */
  h2: Heading[];
  /** H3 headings */
  h3: Heading[];
  /** H4 headings */
  h4: Heading[];
  /** H5 headings */
  h5: Heading[];
  /** H6 headings */
  h6: Heading[];
  /** Images with their attributes */
  images: ImageDetails[];
}

/**
 * Heading information
 */
export interface Heading {
  /** Text content of the heading */
  textContent: string;
}

/**
 * Image element details
 */
export interface ImageDetails {
  /** Source URL of the image */
  src: string;
  /** Alt text of the image */
  alt: string;
}

/**
 * All page resources found during analysis
 */
export interface PageResources {
  /** Links found on the page */
  links: LinkDetails[];
  /** JavaScript files and inline scripts */
  scripts: ScriptDetails[];
  /** CSS files and inline styles */
  styles: StyleDetails[];
}

/**
 * Link element details
 */
export interface LinkDetails {
  /** Link URL */
  href: string;
  /** Link text content */
  textContent: string;
  /** Whether the link is internal to the same domain */
  isInternal: boolean;
  /** Rel attribute value */
  rel?: string | undefined;
}

/**
 * Formatted content structures for LLM-friendly output
 */
export interface FormattedHeadings {
  [level: string]: {
    count: number;
    textContent: string[];
  };
}

export interface FormattedLinks {
  count: number;
  links: LinkDetails[];
}

export interface ResourceSizes {
  scriptSize: number;
  styleSize: number;
}

/** Screenshot information */
export interface ScreenshotInfo {
  filename?: string;
  url?: string; // served path
  base64?: string; // data uri for immediate preview
  size?: number; // bytes
  status?: number | null;
  headers?: Record<string, string> | undefined;
}

/**
 * Script element details
 */
export interface ScriptDetails {
  /** External script source URL */
  src?: string;
  /** Inline script content */
  inlineContent?: string;
}

/**
 * Style element details
 */
export interface StyleDetails {
  /** External stylesheet URL */
  href?: string;
  /** Inline style content */
  inlineContent?: string;
}

/**
 * Error response interface for API errors
 */
export interface ApiError {
  /** Error type/code */
  error: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: any;
}

/**
 * Audit request parameters
 */
export interface AuditRequest {
  /** URL to audit */
  url: string;
}

/**
 * Audit options for internal use
 */
export interface AuditOptions {
  /** Timeout for page loading in milliseconds */
  timeout?: number;
  /** Whether to include screenshots */
  includeScreenshot?: boolean;
  /** Screenshot image type: 'jpeg' or 'png' */
  screenshotType?: 'jpeg' | 'png';
  /** Screenshot quality for jpeg (1-100) */
  screenshotQuality?: number;
  /** User agent string to use */
  userAgent?: string;
}
