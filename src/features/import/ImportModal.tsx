import { useState, useEffect, type ChangeEvent, type ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';
import { useEditor } from '../../editor/EditorContext';
import { importDocument } from '../../domain/document/importDocument';
import { loadSanitizedDocumentIntoAdapter } from '../../domain/document/loadDocument';
import type { SanitizedDocument } from '../../domain/document/types';
import { generateProjectId } from '../../data/projects/schema';
import {
  detectDocumentFonts,
  createLocalFontFaceCss,
  injectFontFaceCss,
  type DetectedFont
} from '../../domain/document/fontDetector';
import {
  detectDocumentLanguageAndDirection,
  type DirectionDetectionResult
} from '../../domain/document/directionDetector';
import './import.css';

export function ImportModal(): ReactElement | null {
  const {
    isImportModalOpen,
    setImportModalOpen,
    isDirty,
    setIsDirty,
    setCurrentProject,
    setCurrentDirection
  } = useUiStore();
  const { adapter } = useEditor();

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedHtml, setPastedHtml] = useState('');
  const [uploadedHtml, setUploadedHtml] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stagedDoc, setStagedDoc] = useState<SanitizedDocument | null>(null);
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);

  // Direction and Font Detection State (Intelligent Arabic RTL vs English LTR)
  const [selectedDirection, setSelectedDirection] = useState<'rtl' | 'ltr'>('rtl');
  const [detectedMeta, setDetectedMeta] = useState<DirectionDetectionResult | null>(null);
  const [detectedFonts, setDetectedFonts] = useState<DetectedFont[]>([]);
  const [localFontCss, setLocalFontCss] = useState<string>('');
  const [loadedLocalFonts, setLoadedLocalFonts] = useState<Record<string, string>>({});
  const [fontUploadMessage, setFontUploadMessage] = useState<string | null>(null);

  const handleClose = (): void => {
    setImportModalOpen(false);
    setErrorMessage(null);
    setStagedDoc(null);
    setShowDirtyConfirm(false);
    setFontUploadMessage(null);
  };

  useEffect(() => {
    if (!isImportModalOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isImportModalOpen]);

  // Real-time font detection and language/direction detection on input change
  useEffect(() => {
    const rawHtml = activeTab === 'upload' ? uploadedHtml : pastedHtml;
    if (!rawHtml || !rawHtml.trim()) {
      setDetectedFonts([]);
      setDetectedMeta(null);
      return;
    }

    try {
      const fonts = detectDocumentFonts(rawHtml);
      setDetectedFonts(fonts);

      const detection = detectDocumentLanguageAndDirection(rawHtml);
      setDetectedMeta(detection);
      setSelectedDirection(detection.direction);
    } catch {
      // Safe fallback for detection errors
    }
  }, [uploadedHtml, pastedHtml, activeTab]);

  if (!isImportModalOpen) {
    return null;
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>): void => {
    setErrorMessage(null);
    setStagedDoc(null);
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.html') && !lowerName.endsWith('.htm')) {
      setErrorMessage('Unsupported file format. Please upload an HTML file (.html or .htm).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 5 MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setUploadedHtml(content);
        setUploadedFileName(file.name);
      }
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read selected file.');
    };
    reader.readAsText(file);
  };

  const handleLocalFontUpload = (fontName: string, e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    let format = 'woff2';
    if (lowerName.endsWith('.ttf')) format = 'truetype';
    else if (lowerName.endsWith('.otf')) format = 'opentype';
    else if (lowerName.endsWith('.woff')) format = 'woff';
    else if (lowerName.endsWith('.woff2')) format = 'woff2';

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === 'string') {
        const cssSnippet = createLocalFontFaceCss(fontName, dataUrl, format);
        setLocalFontCss((prev) => `${prev}\n${cssSnippet}`);
        setLoadedLocalFonts((prev) => ({ ...prev, [fontName]: file.name }));

        // Inject into canvas iframe if available
        const canvasDoc =
          (
            adapter as unknown as { Canvas?: { getDocument?: () => Document } }
          )?.Canvas?.getDocument?.() || null;
        injectFontFaceCss(cssSnippet, fontName, canvasDoc);
        setFontUploadMessage(`✓ تم تفعيل الخط "${fontName}" بنجاح من الملف المحلي!`);
      }
    };
    reader.readAsDataURL(file);
  };

  const executeImport = (doc: SanitizedDocument): void => {
    if (!adapter) {
      setErrorMessage('Visual editor is not initialized.');
      return;
    }

    try {
      const finalDir = selectedDirection;
      const detectedLang =
        doc.lang || (detectedMeta ? detectedMeta.language : finalDir === 'rtl' ? 'ar' : 'en');
      const combinedCss = localFontCss
        ? doc.css
          ? `${doc.css}\n${localFontCss}`
          : localFontCss
        : doc.css;

      const docToLoad: SanitizedDocument = {
        ...doc,
        dir: finalDir,
        lang: detectedLang,
        css: combinedCss
      };

      loadSanitizedDocumentIntoAdapter(adapter, docToLoad);
      adapter.setDirection?.(finalDir);
      setCurrentDirection(finalDir);

      setCurrentProject({
        id: generateProjectId(),
        name:
          doc.title && doc.title !== 'Untitled Document'
            ? doc.title
            : uploadedFileName || 'Imported Document',
        sourceMeta: {
          sourceType: activeTab === 'upload' ? 'file' : 'paste',
          originalFileName: activeTab === 'upload' ? uploadedFileName || undefined : undefined,
          importedTitle: doc.title,
          importedLang: detectedLang,
          importedDir: finalDir,
          externalStylesheets: doc.externalStylesheets || [],
          importWarnings: doc.warnings || []
        }
      });
      setIsDirty(false);
      handleClose();
    } catch (err) {
      setErrorMessage(
        `Failed to load document into canvas: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleImportSubmit = (): void => {
    setErrorMessage(null);
    const rawHtml =
      activeTab === 'upload'
        ? uploadedHtml && uploadedHtml.trim()
          ? uploadedHtml
          : pastedHtml
        : pastedHtml;

    if (!rawHtml || !rawHtml.trim()) {
      setErrorMessage('Please provide HTML markup or upload an HTML file.');
      return;
    }

    try {
      const sanitized = importDocument(rawHtml);

      // If user has unsaved changes, prompt confirmation first (AC-IMPORT-009)
      if (isDirty) {
        setStagedDoc(sanitized);
        setShowDirtyConfirm(true);
        return;
      }

      executeImport(sanitized);
    } catch (err) {
      setErrorMessage(
        `Import failed: ${err instanceof Error ? err.message : 'Unknown parsing error'}`
      );
    }
  };

  const handleConfirmReplace = (): void => {
    if (stagedDoc) {
      executeImport(stagedDoc);
    }
  };

  const handleCancelReplace = (): void => {
    setShowDirtyConfirm(false);
    setStagedDoc(null);
  };

  const hasContent = Boolean(
    activeTab === 'upload'
      ? (uploadedHtml && uploadedHtml.trim()) || uploadedFileName
      : pastedHtml && pastedHtml.trim()
  );

  return (
    <div
      className="modal-backdrop"
      onClick={handleClose}
      role="presentation"
      data-testid="import-modal-backdrop"
    >
      <div
        className="import-modal"
        role="dialog"
        aria-labelledby="import-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        data-testid="import-modal-dialog"
      >
        {/* Header */}
        <div className="modal-header">
          <h2 id="import-dialog-title" className="modal-title">
            Import HTML Document
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close dialog"
            data-testid="btn-close-import"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="modal-tabs" role="tablist" aria-label="Import methods">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'upload'}
            className={`modal-tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
            data-testid="tab-upload"
          >
            Upload File (.html)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'paste'}
            className={`modal-tab-btn ${activeTab === 'paste' ? 'active' : ''}`}
            onClick={() => setActiveTab('paste')}
            data-testid="tab-paste"
          >
            Paste Markup
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Top Error Alert Banner */}
          {errorMessage && (
            <div className="import-banner error" role="alert" data-testid="import-error-banner">
              <strong>Error: </strong>
              {errorMessage}
            </div>
          )}

          {/* Unsaved Changes Confirmation Banner (AC-IMPORT-009) */}
          {showDirtyConfirm && (
            <div
              className="import-banner dirty-confirm"
              role="alert"
              data-testid="import-dirty-confirm"
            >
              <div>
                <strong>Unsaved Changes Warning:</strong> You have unsaved changes in your current
                project. Importing this document will replace your entire visual canvas.
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className="modal-btn danger"
                  onClick={handleConfirmReplace}
                  data-testid="btn-confirm-replace"
                >
                  Overwrite and Import
                </button>
                <button
                  type="button"
                  className="modal-btn secondary"
                  onClick={handleCancelReplace}
                  data-testid="btn-cancel-replace"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Staged Warnings Banner (AC-IMPORT-007, T-0313) */}
          {stagedDoc && stagedDoc.warnings.length > 0 && (
            <div className="import-banner warnings" data-testid="import-warnings-banner">
              <div className="warnings-header">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Security &amp; Compatibility Notes ({stagedDoc.warnings.length})
                </span>
              </div>
              <ul className="warnings-list">
                {stagedDoc.warnings.map((w, index) => (
                  <li key={`${w.code}-${index}`}>
                    <span className="warning-code-tag">{w.code}</span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tab 1: Upload File Flow (T-0312) - Primary First Tab */}
          <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
            <div className="file-dropzone">
              <label className="dropzone-label" htmlFor="file-upload-input">
                <span className="dropzone-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 12 15 15" />
                  </svg>
                </span>
                <span>Click to select an HTML file (.html, .htm) up to 5 MB</span>
              </label>
              <input
                id="file-upload-input"
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                data-testid="import-file-input"
              />
            </div>

            {uploadedFileName && (
              <div style={{ marginTop: '12px' }}>
                <span className="file-selected-badge" data-testid="selected-file-badge">
                  ✓ {uploadedFileName}
                </span>
              </div>
            )}
          </div>

          {/* Tab 2: Paste HTML Flow (T-0311) */}
          <div style={{ display: activeTab === 'paste' ? 'block' : 'none' }}>
            <label
              htmlFor="import-paste-input"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}
            >
              Paste HTML source markup or document fragment:
            </label>
            <textarea
              id="import-paste-input"
              className="import-textarea"
              placeholder="<!DOCTYPE html><html><head><title>My Page</title></head><body><h1>Hello</h1></body></html>"
              value={pastedHtml}
              onChange={(e) => {
                setPastedHtml(e.target.value);
                setActiveTab('paste');
                setErrorMessage(null);
                setStagedDoc(null);
                setShowDirtyConfirm(false);
              }}
              data-testid="import-paste-textarea"
            />
          </div>

          {/* Direction Configuration with Intelligent Auto-Detection Badge */}
          {hasContent && (
            <div className="import-direction-section" data-testid="import-direction-section">
              <div className="import-section-title-row">
                <span className="import-section-title">اتجاه المستند (Document Direction):</span>
                {detectedMeta && (
                  <span
                    className={`detection-status-pill ${detectedMeta.isArabic ? 'arabic' : 'english'}`}
                    data-testid="detected-direction-pill"
                  >
                    {detectedMeta.isArabic
                      ? '✨ تم التعرف تلقائياً: محتوى عربي (RTL)'
                      : '✨ Auto-detected: English / LTR'}
                  </span>
                )}
              </div>
              <div className="import-direction-radios">
                <label
                  className={`direction-option ${selectedDirection === 'rtl' ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="import-direction"
                    value="rtl"
                    checked={selectedDirection === 'rtl'}
                    onChange={() => setSelectedDirection('rtl')}
                    data-testid="radio-dir-rtl"
                  />
                  <span>عربي / من اليمين لليسار (RTL)</span>
                </label>
                <label
                  className={`direction-option ${selectedDirection === 'ltr' ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="import-direction"
                    value="ltr"
                    checked={selectedDirection === 'ltr'}
                    onChange={() => setSelectedDirection('ltr')}
                    data-testid="radio-dir-ltr"
                  />
                  <span>إنجليزي / من اليسار لليمين (LTR)</span>
                </label>
              </div>
            </div>
          )}

          {/* Detected Fonts & Local Font Upload Section */}
          {hasContent && detectedFonts.length > 0 && (
            <div className="detected-fonts-section" data-testid="detected-fonts-section">
              <div className="detected-fonts-header">
                <span className="import-section-title">
                  🔤 الخطوط المكتشفة في الملف ({detectedFonts.length})
                </span>
                <span className="detected-fonts-hint">
                  التعرف التلقائي على الخطوط العربية مع إمكانية تحميل ملفات الخطوط محلياً
                </span>
              </div>

              {fontUploadMessage && (
                <div className="font-success-banner" role="status">
                  {fontUploadMessage}
                </div>
              )}

              <div className="detected-fonts-list">
                {detectedFonts.map((font) => {
                  const isLocalLoaded = Boolean(loadedLocalFonts[font.name]);
                  return (
                    <div key={font.name} className="detected-font-card">
                      <div className="detected-font-info">
                        <strong className="detected-font-name">{font.name}</strong>
                        <span className="detected-font-type">
                          {font.isArabic ? 'خط عربي' : 'Web Font'}
                        </span>
                      </div>
                      <div className="detected-font-actions">
                        {isLocalLoaded ? (
                          <span className="font-badge success">
                            ✓ مفعل محلياً ({loadedLocalFonts[font.name]})
                          </span>
                        ) : font.isAvailableOnGoogleFonts ? (
                          <span className="font-badge google">
                            ✓ متاح على Google Fonts (تفعيل تلقائي)
                          </span>
                        ) : (
                          <label
                            className="font-upload-label"
                            title="تحميل ملف الخط محلياً (.woff2, .woff, .ttf, .otf)"
                          >
                            <span
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                                <line x1="12" y1="10" x2="12" y2="16" />
                                <line x1="9" y1="13" x2="15" y2="13" />
                              </svg>
                              تحميل الخط محلياً
                            </span>
                            <input
                              type="file"
                              accept=".woff2,.woff,.ttf,.otf"
                              onChange={(e) => handleLocalFontUpload(font.name, e)}
                              style={{ display: 'none' }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="modal-btn secondary"
            onClick={handleClose}
            data-testid="btn-cancel-import"
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn primary"
            onClick={handleImportSubmit}
            disabled={
              activeTab === 'upload'
                ? !uploadedHtml.trim() && !pastedHtml.trim()
                : !pastedHtml.trim()
            }
            data-testid="btn-import-submit"
          >
            Import HTML
          </button>
        </div>
      </div>
    </div>
  );
}
