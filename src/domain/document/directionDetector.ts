/**
 * Language and Direction Detector
 * Intelligently detects whether an HTML document or text fragment is Arabic (RTL) or English/LTR.
 */

export interface DirectionDetectionResult {
  direction: 'rtl' | 'ltr';
  language: 'ar' | 'en';
  isArabic: boolean;
  arabicCharCount: number;
  latinCharCount: number;
  detectedReason: string;
}

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_CHAR_REGEX = /[a-zA-Z]/g;

/**
 * Extracts visible plain text from raw HTML, stripping tags, styles, scripts, and comments.
 */
export function extractPlainTextFromHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // If running in browser or jsdom environment with DOMParser available
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove style, script, noscript, and svg elements
      const elementsToRemove = doc.querySelectorAll('script, style, noscript, svg, code');
      elementsToRemove.forEach((el) => el.remove());

      const text = doc.body?.textContent || doc.documentElement?.textContent || '';
      return text.trim();
    } catch {
      // Fallback to regex-based extraction
    }
  }

  // Regex-based fallback for environments without working DOMParser
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects whether an HTML string is Arabic (RTL) or English (LTR).
 *
 * Evaluation Order:
 * 1. Checks explicit `dir` and `lang` attributes on <html> and <body>.
 * 2. Extracts visible plain text content (excluding HTML tags and CSS class names).
 * 3. Compares Arabic character frequency against Latin character frequency.
 * 4. Yields a deterministic direction, language, and human-readable explanation.
 */
export function detectDocumentLanguageAndDirection(rawHtml: string): DirectionDetectionResult {
  if (!rawHtml || !rawHtml.trim()) {
    return {
      direction: 'ltr',
      language: 'en',
      isArabic: false,
      arabicCharCount: 0,
      latinCharCount: 0,
      detectedReason: 'Empty document - defaulted to LTR'
    };
  }

  // 1. Inspect explicit attributes
  const explicitDirMatch = rawHtml.match(/<(?:html|body)[^>]*\sdir=["'](rtl|ltr)["']/i);
  const explicitDir = explicitDirMatch?.[1]?.toLowerCase() as 'rtl' | 'ltr' | undefined;

  const explicitLangMatch = rawHtml.match(/<(?:html|body)[^>]*\slang=["']([a-zA-Z-]+)["']/i);
  const explicitLang = explicitLangMatch?.[1]?.toLowerCase();
  const isExplicitArabicLang = Boolean(explicitLang && explicitLang.startsWith('ar'));
  const isExplicitEnglishLang = Boolean(
    explicitLang &&
    (explicitLang.startsWith('en') ||
      explicitLang.startsWith('fr') ||
      explicitLang.startsWith('de') ||
      explicitLang.startsWith('es'))
  );

  // 2. Extract visible plain text to avoid matching HTML tags / CSS class names
  const plainText = extractPlainTextFromHtml(rawHtml);

  const arabicMatches = plainText.match(ARABIC_CHAR_REGEX) || [];
  const latinMatches = plainText.match(LATIN_CHAR_REGEX) || [];

  const arabicCharCount = arabicMatches.length;
  const latinCharCount = latinMatches.length;

  // 3. Heuristic Decision Matrix

  // Case A: Explicit dir="rtl" or explicit Arabic language
  if (explicitDir === 'rtl') {
    return {
      direction: 'rtl',
      language: 'ar',
      isArabic: true,
      arabicCharCount,
      latinCharCount,
      detectedReason: 'Explicit dir="rtl" attribute in HTML'
    };
  }

  if (isExplicitArabicLang && explicitDir !== 'ltr') {
    return {
      direction: 'rtl',
      language: 'ar',
      isArabic: true,
      arabicCharCount,
      latinCharCount,
      detectedReason: 'Arabic lang attribute detected (lang="ar")'
    };
  }

  // Case B: Explicit dir="ltr"
  if (explicitDir === 'ltr') {
    // If predominantly Arabic text content despite an old dir="ltr", prefer Arabic
    if (arabicCharCount > 20 && arabicCharCount > latinCharCount * 2) {
      return {
        direction: 'rtl',
        language: 'ar',
        isArabic: true,
        arabicCharCount,
        latinCharCount,
        detectedReason: 'Predominantly Arabic text content (overriding LTR tag)'
      };
    }
    return {
      direction: 'ltr',
      language: isExplicitArabicLang ? 'ar' : 'en',
      isArabic: false,
      arabicCharCount,
      latinCharCount,
      detectedReason: 'Explicit dir="ltr" attribute in HTML'
    };
  }

  // Case C: Arabic character content analysis
  // If document has any significant Arabic characters
  if (arabicCharCount > 0) {
    // If Arabic characters represent at least 25% of all letters or exceed Latin letters
    if (arabicCharCount >= latinCharCount * 0.25 || arabicCharCount >= 10) {
      return {
        direction: 'rtl',
        language: 'ar',
        isArabic: true,
        arabicCharCount,
        latinCharCount,
        detectedReason: `Arabic text content detected (${arabicCharCount} Arabic characters)`
      };
    }
  }

  // Case D: Explicit English language attribute without Arabic content
  if (isExplicitEnglishLang) {
    return {
      direction: 'ltr',
      language: 'en',
      isArabic: false,
      arabicCharCount,
      latinCharCount,
      detectedReason: `English language attribute detected (lang="${explicitLang}")`
    };
  }

  // Case E: Latin / English character dominance
  if (latinCharCount > 0 && arabicCharCount === 0) {
    return {
      direction: 'ltr',
      language: 'en',
      isArabic: false,
      arabicCharCount,
      latinCharCount,
      detectedReason: `English / Latin text content detected (${latinCharCount} characters)`
    };
  }

  // Case F: Mixed content with more Latin than Arabic
  if (latinCharCount > arabicCharCount) {
    return {
      direction: 'ltr',
      language: 'en',
      isArabic: false,
      arabicCharCount,
      latinCharCount,
      detectedReason: `Predominantly Latin text content (${latinCharCount} Latin vs ${arabicCharCount} Arabic)`
    };
  }

  // Default fallback: if any Arabic is present return RTL, otherwise LTR
  if (arabicCharCount > 0) {
    return {
      direction: 'rtl',
      language: 'ar',
      isArabic: true,
      arabicCharCount,
      latinCharCount,
      detectedReason: 'Arabic characters detected in content'
    };
  }

  return {
    direction: 'ltr',
    language: 'en',
    isArabic: false,
    arabicCharCount: 0,
    latinCharCount: 0,
    detectedReason: 'Default Left-to-Right (LTR)'
  };
}
