import { describe, it, expect } from 'vitest';
import { detectDocumentLanguageAndDirection, extractPlainTextFromHtml } from './directionDetector';

describe('Language & Direction Detector (directionDetector)', () => {
  it('detects pure Arabic content and assigns RTL direction', () => {
    const html = `
      <section>
        <h1>مرحبا بكم في منشئ الصفحات المرئي</h1>
        <p>هذا النص تجريبي باللغة العربية لاختبار اتجاه الصفحة من اليمين لليسار.</p>
      </section>
    `;
    const result = detectDocumentLanguageAndDirection(html);
    expect(result.direction).toBe('rtl');
    expect(result.language).toBe('ar');
    expect(result.isArabic).toBe(true);
    expect(result.arabicCharCount).toBeGreaterThan(30);
  });

  it('detects pure English content and assigns LTR direction', () => {
    const html = `
      <section class="hero-container" style="padding: 20px;">
        <h1 class="title">Welcome to the Visual HTML Builder</h1>
        <p class="description">Create beautiful landing pages effortlessly with drag and drop.</p>
        <button class="btn btn-primary">Get Started</button>
      </section>
    `;
    const result = detectDocumentLanguageAndDirection(html);
    expect(result.direction).toBe('ltr');
    expect(result.language).toBe('en');
    expect(result.isArabic).toBe(false);
    expect(result.arabicCharCount).toBe(0);
    expect(result.latinCharCount).toBeGreaterThan(30);
  });

  it('honors explicit dir="rtl" on html or body', () => {
    const html =
      '<!DOCTYPE html><html dir="rtl"><head><title>Test</title></head><body>Content</body></html>';
    const result = detectDocumentLanguageAndDirection(html);
    expect(result.direction).toBe('rtl');
    expect(result.language).toBe('ar');
  });

  it('honors explicit dir="ltr" for English content', () => {
    const html =
      '<!DOCTYPE html><html dir="ltr"><head><title>Portfolio</title></head><body><h1>Hello</h1></body></html>';
    const result = detectDocumentLanguageAndDirection(html);
    expect(result.direction).toBe('ltr');
    expect(result.language).toBe('en');
  });

  it('honors explicit lang="ar" on html tag', () => {
    const html =
      '<html lang="ar"><head><title>موقع</title></head><body><div>محتوى</div></body></html>';
    const result = detectDocumentLanguageAndDirection(html);
    expect(result.direction).toBe('rtl');
    expect(result.language).toBe('ar');
  });

  it('detects English when html lang="en" is provided without Arabic characters', () => {
    const html =
      '<html lang="en"><head><title>My Blog</title></head><body><p>Article content here.</p></body></html>';
    const result = detectDocumentLanguageAndDirection(html);
    expect(result.direction).toBe('ltr');
    expect(result.language).toBe('en');
    expect(result.isArabic).toBe(false);
  });

  it('does not falsely count CSS classes or HTML tags as English text for Arabic documents', () => {
    const html = `
      <div class="super-long-class-name-container-wrapper-item-navigation-bar" style="margin-left: 20px; font-weight: bold;">
        <h1>عنوان المقال</h1>
      </div>
    `;
    const plainText = extractPlainTextFromHtml(html);
    expect(plainText).not.toContain('super-long-class-name');
    expect(plainText).toContain('عنوان المقال');

    const result = detectDocumentLanguageAndDirection(html);
    expect(result.direction).toBe('rtl');
    expect(result.isArabic).toBe(true);
  });

  it('handles empty or blank string gracefully', () => {
    const result = detectDocumentLanguageAndDirection('');
    expect(result.direction).toBe('ltr');
    expect(result.language).toBe('en');
  });
});
