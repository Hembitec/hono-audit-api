import * as cheerio from 'cheerio';
import {
  WebsiteAuditResult,
  PageMetadata,
  SeoDetails,
  ContentDetails,
  PageResources,
  MetaTag,
  OgTag,
  Heading,
  ImageDetails,
  LinkDetails,
  ScriptDetails,
  StyleDetails
} from '../types/interfaces.js';
import {
  cleanText,
  resolveUrl,
  isInternalUrl,
  safeJsonParse
} from '../utils/helpers.js';

/**
 * HTML parser service using Cheerio for efficient DOM parsing
 * Extracts all required data from HTML content
 */
export class HtmlParser {
  private $: cheerio.CheerioAPI;
  private baseUrl: string;

  constructor(html: string, baseUrl: string) {
    this.$ = cheerio.load(html);
    this.baseUrl = baseUrl;
  }

  /**
   * Extract all audit data from the HTML
   * @param statusCode - HTTP status code from the response
   * @returns Complete website audit result
   */
  extractAuditData(statusCode: number): Omit<WebsiteAuditResult, 'performance'> {
    return {
      url: this.baseUrl,
      statusCode,
      metadata: this.extractMetadata(),
      seo: this.extractSeoDetails(),
      content: this.extractContentDetails(),
      resources: this.extractPageResources(),
      structuredData: this.extractStructuredData(),
      // Formatted summary useful for LLM consumption (aggregated, compact)
      formattedContent: {
        headings: this.getFormattedHeadings(),
        links: this.getFormattedLinks(),
        resourceSizes: this.getResourceSizes(),
      },
    };
  }

  /**
   * Extract page metadata from HTML head
   * @returns Page metadata object
   */
  private extractMetadata(): PageMetadata {
    const $ = this.$;
    
    const result: PageMetadata = {};
    
    const lang = $('html').attr('lang');
    if (lang) result.lang = lang;
    
    const charset = $('meta[charset]').attr('charset') || 
                   $('meta[http-equiv="content-type"]').attr('content')?.match(/charset=([^;]+)/i)?.[1];
    if (charset) result.charset = charset;
    
    const favicon = this.extractFavicon();
    if (favicon) result.favicon = favicon;
    
    const viewport = $('meta[name="viewport"]').attr('content');
    if (viewport) result.viewport = viewport;
    
    return result;
  }

  /**
   * Extract favicon URL
   * @returns Favicon URL or undefined
   */
  private extractFavicon(): string | undefined {
    const $ = this.$;
    
    // Try different favicon selectors in order of preference
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]'
    ];

    for (const selector of selectors) {
      const href = $(selector).first().attr('href');
      if (href) {
        return resolveUrl(href, this.baseUrl);
      }
    }

    // Fallback to default favicon location
    return resolveUrl('/favicon.ico', this.baseUrl);
  }

  /**
   * Extract SEO-related information
   * @returns SEO details object
   */
  private extractSeoDetails(): SeoDetails {
    const $ = this.$;
    
    const result: SeoDetails = {
      title: cleanText($('title').text() || ''),
      description: cleanText($('meta[name="description"]').attr('content') || ''),
      metaTags: this.extractMetaTags(),
      ogTags: this.extractOpenGraphTags(),
    };
    
    const canonicalUrl = this.extractCanonicalUrl();
    if (canonicalUrl) result.canonicalUrl = canonicalUrl;
    
    return result;
  }

  /**
   * Extract all meta tags
   * @returns Array of meta tags
   */
  private extractMetaTags(): MetaTag[] {
    const $ = this.$;
    const metaTags: MetaTag[] = [];

    $('meta').each((_, element) => {
      const $meta = $(element);
      const name = $meta.attr('name');
      const property = $meta.attr('property');
      const content = $meta.attr('content');

      if (content && (name || property)) {
        const metaTag: MetaTag = {
          content: cleanText(content),
        };
        
        if (name) metaTag.name = name;
        if (property) metaTag.property = property;
        
        metaTags.push(metaTag);
      }
    });

    return metaTags;
  }

  /**
   * Extract canonical URL
   * @returns Canonical URL or undefined
   */
  private extractCanonicalUrl(): string | undefined {
    const href = this.$('link[rel="canonical"]').attr('href');
    return href ? resolveUrl(href, this.baseUrl) : undefined;
  }

  /**
   * Extract Open Graph tags
   * @returns Array of Open Graph tags
   */
  private extractOpenGraphTags(): OgTag[] {
    const $ = this.$;
    const ogTags: OgTag[] = [];

    $('meta[property^="og:"], meta[name^="og:"]').each((_, element) => {
      const $meta = $(element);
      const property = $meta.attr('property') || $meta.attr('name');
      const content = $meta.attr('content');

      if (property && content) {
        ogTags.push({
          property,
          content: cleanText(content),
        });
      }
    });

    return ogTags;
  }

  /**
   * Extract content structure (headings and images)
   * @returns Content details object
   */
  private extractContentDetails(): ContentDetails {
    return {
      h1: this.extractHeadings('h1'),
      h2: this.extractHeadings('h2'),
      h3: this.extractHeadings('h3'),
      h4: this.extractHeadings('h4'),
      h5: this.extractHeadings('h5'),
      h6: this.extractHeadings('h6'),
      images: this.extractImages(),
    };
  }

  /**
   * Extract headings of a specific level
   * @param level - Heading level (h1, h2, etc.)
   * @returns Array of headings
   */
  private extractHeadings(level: string): Heading[] {
    const $ = this.$;
    const headings: Heading[] = [];

    $(level).each((_, element) => {
      const text = cleanText($(element).text());
      if (text) {
        headings.push({ textContent: text });
      }
    });

    return headings;
  }

  /**
   * Extract image details
   * @returns Array of image details
   */
  private extractImages(): ImageDetails[] {
    const $ = this.$;
    const images: ImageDetails[] = [];

    $('img').each((_, element) => {
      const $img = $(element);
      const src = $img.attr('src');
      
      if (src) {
        images.push({
          src: resolveUrl(src, this.baseUrl),
          alt: cleanText($img.attr('alt') || ''),
        });
      }
    });

    return images;
  }

  /**
   * Extract page resources (links, scripts, styles)
   * @returns Page resources object
   */
  private extractPageResources(): PageResources {
    return {
      links: this.extractLinks(),
      scripts: this.extractScripts(),
      styles: this.extractStyles(),
    };
  }

  /**
   * Extract all links from the page
   * @returns Array of link details
   */
  private extractLinks(): LinkDetails[] {
    const $ = this.$;
    const links: LinkDetails[] = [];

    $('a[href]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        const absoluteUrl = resolveUrl(href, this.baseUrl);
        const textContent = cleanText($link.text());
        
        const linkDetail: LinkDetails = {
          href: absoluteUrl,
          textContent,
          isInternal: isInternalUrl(absoluteUrl, this.baseUrl),
        };
        
        const rel = $link.attr('rel');
        if (rel) linkDetail.rel = rel;
        
        links.push(linkDetail);
      }
    });

    return links;
  }

  /**
   * Extract JavaScript files and inline scripts
   * @returns Array of script details
   */
  private extractScripts(): ScriptDetails[] {
    const $ = this.$;
    const scripts: ScriptDetails[] = [];

    $('script').each((_, element) => {
      const $script = $(element);
      const src = $script.attr('src');
      const inlineContent = $script.html();

      if (src) {
        // External script
        scripts.push({
          src: resolveUrl(src, this.baseUrl),
        });
      } else if (inlineContent && inlineContent.trim()) {
        // Inline script - truncate for safety
        const truncatedContent = inlineContent.length > 1000 
          ? inlineContent.substring(0, 1000) + '...'
          : inlineContent;
        
        scripts.push({
          inlineContent: truncatedContent,
        });
      }
    });

    return scripts;
  }

  /**
   * Extract CSS files and inline styles
   * @returns Array of style details
   */
  private extractStyles(): StyleDetails[] {
    const $ = this.$;
    const styles: StyleDetails[] = [];

    // External stylesheets
    $('link[rel="stylesheet"]').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        styles.push({
          href: resolveUrl(href, this.baseUrl),
        });
      }
    });

    // Inline styles
    $('style').each((_, element) => {
      const content = $(element).html();
      if (content && content.trim()) {
        // Truncate inline styles for safety
        const truncatedContent = content.length > 2000 
          ? content.substring(0, 2000) + '...'
          : content;
        
        styles.push({
          inlineContent: truncatedContent,
        });
      }
    });

    return styles;
  }

  /**
   * Extract structured data from JSON-LD scripts
   * @returns Array of structured data objects
   */
  private extractStructuredData(): any[] {
    const $ = this.$;
    const structuredData: any[] = [];

    $('script[type="application/ld+json"]').each((_, element) => {
      const content = $(element).html();
      if (content) {
        const parsed = safeJsonParse(content.trim());
        if (parsed) {
          structuredData.push(parsed);
        }
      }
    });

    return structuredData;
  }

  /**
   * Get page statistics for analysis
   * @returns Object with page statistics
   */
  getPageStatistics(): PageStatistics {
    const $ = this.$;
    
    return {
      totalElements: $('*').length,
      totalImages: $('img').length,
      totalLinks: $('a[href]').length,
      totalScripts: $('script').length,
      totalStylesheets: $('link[rel="stylesheet"], style').length,
      totalHeadings: $('h1, h2, h3, h4, h5, h6').length,
      wordCount: this.getWordCount(),
      characterCount: this.getCharacterCount(),
    };
  }

  /**
   * Return headings aggregated by level with counts and texts.
   * Example:
   * { h1: { count: 1, textContent: ["..."] }, h2: { count: 3, textContent: ["...", ...] } }
   */
  getFormattedHeadings(): Record<string, { count: number; textContent: string[] }> {
    const levels = ['h1','h2','h3','h4','h5','h6'];
    const formatted: Record<string, { count: number; textContent: string[] }> = {};

    for (const level of levels) {
      const items = this.extractElementsBySelector(level);
      formatted[level] = {
        count: items.length,
        textContent: items,
      };
    }

    return formatted;
  }

  /**
   * Return links aggregated with count and compact list (href + text)
   */
  getFormattedLinks(): { count: number; links: LinkDetails[] } {
    const $ = this.$;
    const links: LinkDetails[] = [];

    $('a[href]').each((_, element) => {
      const $link = $(element);
      const href = $link.attr('href');

      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        const absoluteUrl = resolveUrl(href, this.baseUrl);
        const textContent = cleanText($link.text());

        links.push({
          href: absoluteUrl,
          textContent,
          isInternal: isInternalUrl(absoluteUrl, this.baseUrl),
          rel: $link.attr('rel') || undefined,
        });
      }
    });

    return { count: links.length, links };
  }

  /**
   * Compute total inline script and style sizes (character counts) as a simple metric
   */
  getResourceSizes(): { scriptSize: number; styleSize: number } {
    const $ = this.$;
    let scriptSize = 0;
    let styleSize = 0;

    $('script').each((_, element) => {
      const src = $(element).attr('src');
      if (!src) {
        const content = $(element).html() || '';
        scriptSize += content.length;
      }
    });

    $('style').each((_, element) => {
      const content = $(element).html() || '';
      styleSize += content.length;
    });

    return { scriptSize, styleSize };
  }

  /**
   * Get approximate word count of visible text
   * @returns Word count
   */
  private getWordCount(): number {
    const $ = this.$;
    // Remove script and style content
    const clone = $.root().clone();
    clone.find('script, style').remove();
    
    const text = clone.text();
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * Get character count of visible text
   * @returns Character count
   */
  private getCharacterCount(): number {
    const $ = this.$;
    // Remove script and style content
    const clone = $.root().clone();
    clone.find('script, style').remove();
    
    return clone.text().trim().length;
  }

  /**
   * Extract specific elements by selector
   * @param selector - CSS selector
   * @returns Array of element text content
   */
  extractElementsBySelector(selector: string): string[] {
    const $ = this.$;
    const elements: string[] = [];

    $(selector).each((_, element) => {
      const text = cleanText($(element).text());
      if (text) {
        elements.push(text);
      }
    });

    return elements;
  }

  /**
   * Check if page has specific elements
   * @param selector - CSS selector to check
   * @returns True if elements exist
   */
  hasElements(selector: string): boolean {
    return this.$(selector).length > 0;
  }
}

/**
 * Page statistics interface
 */
export interface PageStatistics {
  totalElements: number;
  totalImages: number;
  totalLinks: number;
  totalScripts: number;
  totalStylesheets: number;
  totalHeadings: number;
  wordCount: number;
  characterCount: number;
}

/**
 * Factory function to create HTML parser
 * @param html - HTML content
 * @param baseUrl - Base URL for resolving relative URLs
 * @returns HTML parser instance
 */
export function createHtmlParser(html: string, baseUrl: string): HtmlParser {
  return new HtmlParser(html, baseUrl);
}
