import { useState, useEffect, type ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';
import { useEditor } from '../../editor/EditorContext';
import { EXAMPLE_TEMPLATES, type ExampleTemplate } from '../../data/templates/exampleTemplates';
import { detectDocumentLanguageAndDirection } from '../../domain/document/directionDetector';
import './templates.css';

export function TemplatesModal(): ReactElement | null {
  const { isTemplatesModalOpen, setTemplatesModalOpen, setCurrentProject, setIsDirty } =
    useUiStore();
  const { adapter } = useEditor();

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isTemplatesModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTemplatesModalOpen]);

  if (!isTemplatesModalOpen) {
    return null;
  }

  const handleClose = (): void => {
    setTemplatesModalOpen(false);
  };

  const categories = ['All', 'Landing Page', 'Portfolio', 'Business', 'Starter'];

  const filteredTemplates =
    selectedCategory === 'All'
      ? EXAMPLE_TEMPLATES
      : EXAMPLE_TEMPLATES.filter((t) => t.category === selectedCategory);

  const handleApplyTemplate = (template: ExampleTemplate): void => {
    if (!adapter) return;

    if (typeof adapter.loadTemplate === 'function') {
      adapter.loadTemplate(template.html, template.css);
    } else if (typeof adapter.resetToBlank === 'function') {
      adapter.resetToBlank();
    }

    const detected = detectDocumentLanguageAndDirection(`${template.html} ${template.css || ''}`);
    adapter.setDirection?.(detected.direction);

    setCurrentProject({
      id: `template-${template.id}-${Date.now()}`,
      name: template.title,
      sourceMeta: {
        sourceType: 'blank',
        importedTitle: template.title,
        importedLang: detected.language,
        importedDir: detected.direction,
        externalStylesheets: [],
        importWarnings: []
      }
    });
    useUiStore.getState().setCurrentDirection(detected.direction);
    setIsDirty(true);
    setLoadedTemplateId(template.id);

    setTimeout(() => {
      setLoadedTemplateId(null);
      handleClose();
    }, 500);
  };

  return (
    <div
      className="templates-modal-backdrop"
      onClick={handleClose}
      role="presentation"
      data-testid="templates-modal-backdrop"
    >
      <div
        className="templates-modal"
        role="dialog"
        aria-labelledby="templates-dialog-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        data-testid="templates-modal-dialog"
      >
        {/* Header */}
        <div className="templates-modal-header">
          <div>
            <h2 id="templates-dialog-title" className="templates-modal-title">
              <span className="templates-title-icon" aria-hidden="true">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  <path d="M5 3v4" />
                  <path d="M19 17v4" />
                  <path d="M3 5h4" />
                  <path d="M17 19h4" />
                </svg>
              </span>
              Starter Examples &amp; Templates (قوالب وأمثلة جاهزة)
            </h2>
            <p className="templates-modal-subtitle">
              Select any pre-built example to instantly load a complete, responsive layout onto your
              canvas.
            </p>
          </div>
          <button
            type="button"
            className="templates-modal-close-btn"
            aria-label="Close templates modal"
            onClick={handleClose}
            data-testid="btn-close-templates"
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

        {/* Filter Bar */}
        <div className="templates-filter-bar">
          <div className="templates-category-tabs" role="tablist" aria-label="Template categories">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={selectedCategory === cat}
                className={`templates-cat-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
                data-testid={`tab-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <span className="templates-count-badge">
            {filteredTemplates.length} {filteredTemplates.length === 1 ? 'Template' : 'Templates'}
          </span>
        </div>

        {/* Templates Grid */}
        <div className="templates-grid-container">
          <div className="templates-grid">
            {filteredTemplates.map((template) => {
              const isLoaded = loadedTemplateId === template.id;
              return (
                <div
                  key={template.id}
                  className="template-card"
                  data-testid={`template-card-${template.id}`}
                >
                  <div className="template-card-header">
                    <span className="template-icon" aria-hidden="true">
                      {template.thumbnailIcon}
                    </span>
                    <span className="template-badge">{template.category}</span>
                  </div>

                  <div className="template-card-content">
                    <h3 className="template-card-title">{template.title}</h3>
                    <h4 className="template-card-title-ar" dir="rtl">
                      {template.titleAr}
                    </h4>
                    <p className="template-card-desc">{template.description}</p>
                    <p className="template-card-desc-ar" dir="rtl">
                      {template.descriptionAr}
                    </p>
                  </div>

                  <div className="template-card-footer">
                    <button
                      type="button"
                      className={`template-action-btn ${isLoaded ? 'loaded' : ''}`}
                      onClick={() => handleApplyTemplate(template)}
                      data-testid={`btn-apply-template-${template.id}`}
                    >
                      {isLoaded ? '✓ Loaded!' : 'Load Template • استخدم القالب'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="templates-modal-footer">
          <span className="templates-hint-text">
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
              style={{ display: 'inline', verticalAlign: '-2px', marginRight: '5px' }}
              aria-hidden="true"
            >
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
              <path d="M9 18h6" />
              <path d="M10 22h4" />
            </svg>
            Tip: You can customize, inspect, duplicate, and export any template to HTML &amp; PDF
            immediately.
          </span>
          <button type="button" className="templates-footer-close-btn" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
