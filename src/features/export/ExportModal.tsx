import { useState, useEffect, type ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';
import { useEditor } from '../../editor/EditorContext';
import {
  exportStandaloneHtml,
  detectRemoteAssets,
  downloadHtmlFile,
  copyToClipboard,
  printDocument,
  generateA4PrintCss,
} from '../../domain/document/exportDocument';
import './export.css';

export function ExportModal(): ReactElement | null {
  const {
    isExportModalOpen,
    setExportModalOpen,
    currentProjectName,
    currentSourceMeta,
    currentDirection
  } = useUiStore();
  const { adapter } = useEditor();

  const [activeTab, setActiveTab] = useState<'pdf' | 'full' | 'body' | 'css'>('pdf');
  const [docTitle, setDocTitle] = useState(currentProjectName || 'Exported Document');
  const [filename, setFilename] = useState('exported-page.html');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [pageMargin, setPageMargin] = useState<string>('12mm 15mm');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Sync title and default filename when modal opens
  useEffect(() => {
    if (isExportModalOpen) {
      const initialTitle =
        currentProjectName && currentProjectName !== 'Untitled Project'
          ? currentProjectName
          : currentSourceMeta.importedTitle || 'Exported Document';
      setDocTitle(initialTitle);

      const sanitizedName =
        initialTitle
          .toLowerCase()
          .replace(/[^a-z0-9_-]/gi, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '') || 'page';
      setFilename(`${sanitizedName}.html`);
      setCopyFeedback(null);
    }
  }, [isExportModalOpen, currentProjectName, currentSourceMeta.importedTitle]);

  // Handle escape key to close modal (AC-A11Y-004)
  useEffect(() => {
    if (!isExportModalOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportModalOpen]);

  if (!isExportModalOpen) {
    return null;
  }

  const handleClose = (): void => {
    setExportModalOpen(false);
    setCopyFeedback(null);
  };

  // Retrieve current snapshot from editor adapter
  const snapshot = adapter?.getExportSnapshot() || {
    bodyHtml: adapter?.getHtml() || '',
    css: adapter?.getCss() || '',
  };

  const bodyHtml = snapshot.bodyHtml || '';
  const css = snapshot.css || '';

  // The editor's current direction (import detection or the toolbar toggle) is the single
  // source of truth. Never re-infer it from Arabic characters: bilingual documents
  // (e.g. side-by-side English/Arabic CVs) must keep the author's column order.
  const docDir = currentDirection;
  const docLang = currentSourceMeta.importedLang || (docDir === 'rtl' ? 'ar' : 'en');

  // Generate full standalone HTML document (T-0501)
  const fullHtml = exportStandaloneHtml({
    title: docTitle,
    lang: docLang,
    dir: docDir,
    bodyHtml,
    css,
    externalStylesheets: currentSourceMeta.externalStylesheets,
  });

  // Generate specialized A4 simulation HTML document with anti-clipping rules
  const a4SimulationHtml = exportStandaloneHtml({
    title: docTitle,
    lang: docLang,
    dir: docDir,
    bodyHtml,
    css: `
      ${generateA4PrintCss({ orientation, pageMargin })}
      ${css || ''}
      body {
        padding: ${pageMargin} !important;
        background: #ffffff !important;
      }
      table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: auto !important;
        border-collapse: collapse !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
      }
      tr, td, th {
        word-break: break-word !important;
      }
    `,
    externalStylesheets: [
      'https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600;700&family=Cairo:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Tajawal:wght@400;500;700&display=swap',
      ...(currentSourceMeta.externalStylesheets || []),
    ],
  });

  // Detect external assets (T-0507, 06_IMPORT_EXPORT section 12)
  const remoteImages = detectRemoteAssets(bodyHtml);
  const remoteStylesheets = (currentSourceMeta.externalStylesheets || []).filter((s) =>
    /^https?:\/\/|^\/\//i.test(s)
  );
  const allRemoteAssets = Array.from(new Set([...remoteImages, ...remoteStylesheets]));
  const hasRemoteAssets = allRemoteAssets.length > 0;

  // Determine active preview content
  const previewContent =
    activeTab === 'body' ? bodyHtml : activeTab === 'css' ? css : fullHtml;

  const showCopyToast = (message: string): void => {
    setCopyFeedback(message);
    setTimeout(() => {
      setCopyFeedback(null);
    }, 2500);
  };

  const handleDownload = (): void => {
    downloadHtmlFile(fullHtml, filename);
  };

  const handleCopyFull = async (): Promise<void> => {
    const success = await copyToClipboard(fullHtml);
    if (success) {
      showCopyToast('Full standalone HTML copied to clipboard!');
    }
  };

  const handleCopyBody = async (): Promise<void> => {
    const success = await copyToClipboard(bodyHtml);
    if (success) {
      showCopyToast('Body HTML copied to clipboard!');
    }
  };

  const handleCopyCss = async (): Promise<void> => {
    const success = await copyToClipboard(css);
    if (success) {
      showCopyToast('CSS styles copied to clipboard!');
    }
  };

  const handlePrintPdf = (): void => {
    printDocument({
      title: docTitle,
      lang: docLang,
      dir: docDir,
      bodyHtml,
      css,
      orientation,
      pageMargin,
      externalStylesheets: currentSourceMeta.externalStylesheets,
    });
  };

  return (
    <div
      className="export-modal-backdrop"
      onClick={handleClose}
      role="presentation"
      data-testid="export-modal-backdrop"
    >
      <div
        className="export-modal"
        role="dialog"
        aria-labelledby="export-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        data-testid="export-modal-dialog"
      >
        {/* Modal Header */}
        <div className="export-modal-header">
          <h2 id="export-dialog-title" className="export-modal-title">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export Project HTML & CSS
          </h2>
          <button
            type="button"
            className="export-modal-close-btn"
            aria-label="Close export dialog"
            onClick={handleClose}
            data-testid="btn-close-export"
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

        {/* Modal Body */}
        <div className="export-modal-body">
          {/* Export Settings */}
          <div className="export-config-row">
            <div className="export-config-group">
              <label htmlFor="export-title-input" className="export-config-label">
                HTML Page Title
              </label>
              <input
                id="export-title-input"
                type="text"
                className="export-config-input"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. My Portfolio"
                data-testid="input-export-title"
              />
            </div>
            <div className="export-config-group">
              <label htmlFor="export-filename-input" className="export-config-label">
                Download Filename
              </label>
              <input
                id="export-filename-input"
                type="text"
                className="export-config-input"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="e.g. index.html"
                data-testid="input-export-filename"
              />
            </div>
          </div>

          {/* Remote Asset Warning (T-0507, AC-EXPORT / 06_IMPORT_EXPORT section 12) */}
          {hasRemoteAssets && (
            <div
              className="export-warning-banner"
              data-testid="remote-asset-warning"
              role="alert"
            >
              <svg
                className="export-warning-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="export-warning-content">
                <strong>Notice: Document Contains External Remote Resources</strong>
                <span>
                  This export references external remote URLs (such as images or fonts). The exported
                  standalone HTML requires an active internet connection to load these assets and is
                  not completely offline.
                </span>
                <ul className="export-warning-urls" aria-label="Detected external resources">
                  {allRemoteAssets.map((url, i) => (
                    <li key={i}>{url}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Export View / Tabs Bar */}
          <div className="export-tabs" role="tablist" aria-label="Export format and code view tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pdf'}
              className={`export-tab-btn export-tab-highlight ${activeTab === 'pdf' ? 'active' : ''}`}
              onClick={() => setActiveTab('pdf')}
              data-testid="tab-export-pdf"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              PDF (A4 Sheet Simulation)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'full'}
              className={`export-tab-btn ${activeTab === 'full' ? 'active' : ''}`}
              onClick={() => setActiveTab('full')}
              data-testid="tab-export-full"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              Standalone HTML Document
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'body'}
              className={`export-tab-btn ${activeTab === 'body' ? 'active' : ''}`}
              onClick={() => setActiveTab('body')}
              data-testid="tab-export-body"
            >
              Body HTML Only
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'css'}
              className={`export-tab-btn ${activeTab === 'css' ? 'active' : ''}`}
              onClick={() => setActiveTab('css')}
              data-testid="tab-export-css"
            >
              CSS Only
            </button>
          </div>

          {/* Conditional View: PDF A4 Simulation vs Code Preview */}
          {activeTab === 'pdf' ? (
            <div className="a4-simulator-wrapper" data-testid="a4-simulator-section">
              {/* Simulator Toolbar */}
              <div className="a4-simulator-toolbar">
                <div className="a4-control-group">
                  <span className="a4-control-label">A4 Orientation:</span>
                  <button
                    type="button"
                    className={`a4-toggle-btn ${orientation === 'portrait' ? 'active' : ''}`}
                    onClick={() => setOrientation('portrait')}
                    title="Vertical A4 (210 x 297 mm)"
                  >
                    📄 Portrait (عمودي)
                  </button>
                  <button
                    type="button"
                    className={`a4-toggle-btn ${orientation === 'landscape' ? 'active' : ''}`}
                    onClick={() => setOrientation('landscape')}
                    title="Horizontal A4 (297 x 210 mm)"
                  >
                    📜 Landscape (أفقي)
                  </button>
                </div>

                <div className="a4-control-group">
                  <span className="a4-control-label">Page Margins:</span>
                  <select
                    className="a4-select"
                    value={pageMargin}
                    onChange={(e) => setPageMargin(e.target.value)}
                    aria-label="A4 Page Margins"
                  >
                    <option value="12mm 15mm">Standard (15mm)</option>
                    <option value="8mm 10mm">Compact (8mm)</option>
                    <option value="0mm">None (0mm borderless)</option>
                  </select>
                </div>

                <div className="a4-anti-cut-badge">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Anti-Cutoff & Table Fit Active</span>
                </div>
              </div>

              {/* Realistic A4 Sheet Simulation Canvas */}
              <div className="a4-paper-viewport">
                <div className={`a4-paper-sheet ${orientation}`} data-testid="a4-sheet-preview">
                  <div className="a4-sheet-header-badge">
                    <span>Simulated A4 Sheet • {orientation === 'portrait' ? '210 × 297 mm' : '297 × 210 mm'}</span>
                    <span>100% Vector Print Scale</span>
                  </div>
                  <iframe
                    className="a4-preview-iframe"
                    title="A4 Page Simulation"
                    srcDoc={a4SimulationHtml}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {/* Code Preview Section (Always kept in DOM for testing & inspection) */}
          <div
            className="export-preview-container"
            style={{ display: activeTab === 'pdf' ? 'none' : 'flex' }}
          >
            <div className="export-preview-header">
              <span>
                {activeTab === 'full'
                  ? 'Complete HTML5 file with embedded CSS'
                  : activeTab === 'body'
                    ? 'Canvas elements content'
                    : 'Generated component and layout rules'}
              </span>
              <span>{previewContent.length.toLocaleString()} characters</span>
            </div>
            <pre
              className="export-code-box"
              tabIndex={0}
              aria-label="Exported code preview"
              data-testid="export-code-preview"
            >
              <code>{previewContent || '/* Empty content */'}</code>
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="export-modal-footer">
          <div className="export-footer-left">
            <div className="export-copy-group" aria-label="Quick copy snippets">
              <span className="export-copy-label">Quick Copy:</span>
              <button
                type="button"
                className="export-btn-mini"
                onClick={handleCopyFull}
                data-testid="btn-copy-full-html"
                title="Copy full HTML document"
              >
                Full HTML
              </button>
              <button
                type="button"
                className="export-btn-mini"
                onClick={handleCopyBody}
                data-testid="btn-copy-body-html"
                title="Copy body HTML snippet"
              >
                Body HTML
              </button>
              <button
                type="button"
                className="export-btn-mini"
                onClick={handleCopyCss}
                data-testid="btn-copy-css"
                title="Copy CSS stylesheet"
              >
                CSS
              </button>
            </div>
            {copyFeedback && (
              <span className="export-toast-feedback" data-testid="copy-feedback">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {copyFeedback}
              </span>
            )}
          </div>

          <div className="export-footer-actions">
            <button
              type="button"
              className={`export-btn ${activeTab === 'pdf' ? 'export-btn-primary' : 'export-btn-secondary'}`}
              onClick={handlePrintPdf}
              data-testid="btn-export-pdf"
              title="Print or Save document as PDF (A4)"
            >
              <svg
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
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              Export PDF / Print <span className="export-badge-pill">A4</span>
            </button>

            <button
              type="button"
              className={`export-btn ${activeTab !== 'pdf' ? 'export-btn-primary' : 'export-btn-secondary'}`}
              onClick={handleDownload}
              data-testid="btn-download-export"
              title="Download standalone HTML file"
            >
              <svg
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
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download .html
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
