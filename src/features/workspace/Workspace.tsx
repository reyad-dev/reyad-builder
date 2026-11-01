import { useEffect, type ReactElement } from 'react';
import { useUiStore, type ViewportDevice } from '../../state/uiStore';
import { useEditor } from '../../editor/EditorContext';
import { EditorAdapter } from '../../editor/EditorAdapter';
import { isTypingInInput } from '../../editor/keyboardGuards';
import { EditorCanvasHost } from './EditorCanvasHost';
import { InspectorPanel } from '../inspector/InspectorPanel';
import { ImportModal } from '../import/ImportModal';
import { ExportModal } from '../export/ExportModal';
import { ProjectListModal } from '../projects/ProjectListModal';
import { TemplatesModal } from '../templates/TemplatesModal';
import { defaultProjectRepository } from '../../data/projects/BrowserProjectRepository';
import type { SavedProject } from '../../data/projects/schema';
import { printDocument } from '../../domain/document/exportDocument';
import './workspace.css';

export function Workspace(): ReactElement {
  const {
    currentDevice,
    activeLeftPanel,
    isDirty,
    isSaving,
    saveStatus,
    saveErrorMessage,
    lastSavedAt,
    canUndo,
    canRedo,
    selectedComponent,
    currentProjectId,
    currentProjectName,
    currentProjectCreatedAt,
    currentSourceMeta,
    currentDirection,
    setCurrentDirection,
    setDevice,
    setActiveLeftPanel,
    setImportModalOpen,
    setExportModalOpen,
    setProjectsModalOpen,
    setTemplatesModalOpen,
    setProjectName,
    setIsDirty,
    setSaveStatus,
    setLastSavedAt,
    setCanUndo,
    setCanRedo,
    setSelectedComponent,
    setCurrentProject,
  } = useUiStore();

  const { adapter, setAdapter } = useEditor();

  // Initialize EditorAdapter on mount and clean up on unmount
  useEffect(() => {
    const canvasMount = document.getElementById('gjs-canvas-root');
    const blocksMount = document.getElementById('blocks-panel-mount');
    const layersMount = document.getElementById('layers-panel-mount');

    if (!canvasMount) {
      return;
    }

    const editorAdapter = new EditorAdapter();

    void editorAdapter
      .init({
        container: canvasMount,
        blocksContainer: blocksMount ?? undefined,
        layersContainer: layersMount ?? undefined,
      })
      .then(async () => {
        setAdapter(editorAdapter);
        try {
          const lastActiveId = localStorage.getItem('hvb_last_active_project_id');
          if (lastActiveId) {
            const project = await defaultProjectRepository.get(lastActiveId);
            if (project) {
              editorAdapter.loadProjectData(project.editorProjectData);
              setCurrentProject({
                id: project.id,
                name: project.name,
                createdAt: project.createdAt,
                sourceMeta: project.sourceMeta,
              });
              setIsDirty(false);
            }
          }
        } catch {
          // Ignore error loading cached project
        }
      });

    const unsubHistory = editorAdapter.on('history:change', () => {
      setCanUndo(editorAdapter.canUndo());
      setCanRedo(editorAdapter.canRedo());
    });

    const unsubSelection = editorAdapter.on('selection:change', () => {
      setSelectedComponent(editorAdapter.getSelectedComponent());
    });

    const unsubUpdate = editorAdapter.on('update', () => {
      setIsDirty(true);
      setSelectedComponent(editorAdapter.getSelectedComponent());
    });

    return () => {
      unsubHistory();
      unsubSelection();
      unsubUpdate();
      editorAdapter.destroy();
      setAdapter(null);
    };
  }, [setAdapter, setCanUndo, setCanRedo, setSelectedComponent, setIsDirty]);

  // Synchronize viewport device with editor adapter
  useEffect(() => {
    if (adapter) {
      adapter.setDevice(currentDevice);
    }
  }, [adapter, currentDevice]);

  const handleSave = async (): Promise<void> => {
    if (!adapter) {
      return;
    }
    setSaveStatus('saving');
    try {
      const projectData = (adapter.getProjectData() || {}) as Record<string, unknown>;
      const projectToSave: SavedProject = {
        schemaVersion: 1,
        id: currentProjectId,
        name: currentProjectName.trim() || 'Untitled Project',
        createdAt: currentProjectCreatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceMeta: currentSourceMeta,
        editorProjectData: projectData,
      };

      await defaultProjectRepository.save(projectToSave);
      try {
        localStorage.setItem('hvb_last_active_project_id', projectToSave.id);
      } catch {
        // Ignore localStorage quota/disabled errors
      }
      setSaveStatus('saved');
      setIsDirty(false);
      const now = new Date();
      setLastSavedAt(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveStatus('error', message);
    }
  };

  const handlePrint = (): void => {
    if (!adapter) {
      return;
    }
    const snapshot = adapter.getExportSnapshot();

    // Use the editor's current direction; re-inferring it from Arabic characters would
    // flip bilingual (side-by-side English/Arabic) layouts.
    printDocument({
      title: currentProjectName || 'Exported Document',
      lang: currentSourceMeta.importedLang || (currentDirection === 'rtl' ? 'ar' : 'en'),
      dir: currentDirection,
      bodyHtml: snapshot.bodyHtml,
      css: snapshot.css,
      externalStylesheets: currentSourceMeta.externalStylesheets,
    });
  };

  // Global keyboard shortcuts with focus guards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!adapter) {
        return;
      }

      if (isTypingInInput(e.target)) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Print / PDF: Ctrl+P / Cmd+P
      if (isCtrlOrMeta && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
        return;
      }

      // Save: Ctrl+S / Cmd+S
      if (isCtrlOrMeta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z (without shift)
      if (isCtrlOrMeta && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        adapter.undo();
        return;
      }

      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y
      if (
        (isCtrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (isCtrlOrMeta && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        adapter.redo();
        return;
      }

      // Duplicate: Ctrl+D / Cmd+D
      if (isCtrlOrMeta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        adapter.duplicateSelected();
        return;
      }

      // Delete selected component: Delete key (Del)
      // Note: Backspace is strictly reserved for text typing and must never delete canvas components
      if (e.key === 'Delete') {
        e.preventDefault();
        adapter.deleteSelected();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [adapter, currentProjectId, currentProjectName, currentProjectCreatedAt, currentSourceMeta]);

  const handleDeviceChange = (device: ViewportDevice): void => {
    setDevice(device);
  };

  const handleToggleDirection = (): void => {
    const nextDir = currentDirection === 'rtl' ? 'ltr' : 'rtl';
    setCurrentDirection(nextDir);
    adapter?.setDirection?.(nextDir);
  };

  return (
    <div className="workspace-container" data-testid="workspace-container">
      {/* Top Application Toolbar */}
      <header className="workspace-header" role="banner">
        <div className="workspace-brand">
          <div className="brand-badge" aria-hidden="true">
            VB
          </div>
          <span className="brand-title">HTML Visual Builder</span>
          <input
            type="text"
            className="project-name-input"
            value={currentProjectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Untitled Project"
            aria-label="Project name"
            title="Project name"
            data-testid="input-project-name"
          />
        </div>

        {/* Undo / Redo History Controls */}
        <div className="workspace-history-tools" aria-label="History actions">
          <button
            type="button"
            className="action-btn icon-btn"
            onClick={() => adapter?.undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            data-testid="btn-undo"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
            </svg>
            <span>Undo</span>
          </button>
          <button
            type="button"
            className="action-btn icon-btn"
            onClick={() => adapter?.redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
            aria-label="Redo"
            data-testid="btn-redo"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
            </svg>
            <span>Redo</span>
          </button>
        </div>

        {/* Viewport Device Controls */}
        <nav className="workspace-center-tools" aria-label="Device Preview Modes">
          <button
            type="button"
            className={`device-btn ${currentDevice === 'desktop' ? 'active' : ''}`}
            onClick={() => handleDeviceChange('desktop')}
            aria-label="Desktop preview"
            aria-pressed={currentDevice === 'desktop'}
          >
            Desktop
          </button>
          <button
            type="button"
            className={`device-btn ${currentDevice === 'tablet' ? 'active' : ''}`}
            onClick={() => handleDeviceChange('tablet')}
            aria-label="Tablet preview"
            aria-pressed={currentDevice === 'tablet'}
          >
            Tablet
          </button>
          <button
            type="button"
            className={`device-btn ${currentDevice === 'mobile' ? 'active' : ''}`}
            onClick={() => handleDeviceChange('mobile')}
            aria-label="Mobile preview"
            aria-pressed={currentDevice === 'mobile'}
          >
            Mobile
          </button>
          <button
            type="button"
            className={`device-btn direction-toggle-btn ${currentDirection === 'rtl' ? 'rtl-active' : ''}`}
            onClick={handleToggleDirection}
            title={
              currentDirection === 'rtl'
                ? 'الاتجاه الحالي: عربي / من اليمين لليسار (RTL) - انقر للتحويل إلى LTR'
                : 'Current Direction: Left-to-Right (LTR) - Click to switch to Arabic (RTL)'
            }
            aria-label={`Toggle document direction. Currently ${currentDirection.toUpperCase()}`}
            data-testid="btn-direction-toggle"
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
              style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }}
            >
              <path d="M8 3 4 7l4 4" />
              <path d="M4 7h16" />
              <path d="m16 21 4-4-4-4" />
              <path d="M20 17H4" />
            </svg>
            {currentDirection === 'rtl' ? 'RTL (عربي)' : 'LTR'}
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="workspace-actions">
          <button
            type="button"
            className="action-btn"
            aria-label="Starter Templates & Examples"
            onClick={() => setTemplatesModalOpen(true)}
            data-testid="btn-templates"
            title="Explore Starter Examples & Templates (قوالب وأمثلة جاهزة)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            Templates
          </button>
          <button
            type="button"
            className="action-btn"
            aria-label="Manage Projects"
            onClick={() => setProjectsModalOpen(true)}
            data-testid="btn-projects"
          >
            Projects
          </button>
          <button
            type="button"
            className="action-btn"
            aria-label="Import HTML"
            onClick={() => setImportModalOpen(true)}
            data-testid="btn-import"
          >
            Import
          </button>
          <button
            type="button"
            className="action-btn"
            aria-label="Export HTML"
            onClick={() => setExportModalOpen(true)}
            data-testid="btn-export"
          >
            Export
          </button>
          <button
            type="button"
            className="action-btn"
            aria-label="Print or Save as PDF"
            onClick={handlePrint}
            title="Print or Save as PDF (Ctrl+P)"
            data-testid="btn-print"
          >
            <svg
              width="15"
              height="15"
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
            Print
          </button>
          <button
            type="button"
            className="action-btn primary"
            aria-label="Save Project"
            disabled={isSaving}
            onClick={() => void handleSave()}
            data-testid="btn-save"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Save Error Alert Banner */}
      {saveStatus === 'error' && saveErrorMessage && (
        <div className="save-error-alert" role="alert" data-testid="save-error-banner">
          <span>
            <strong>Storage Error:</strong> {saveErrorMessage}
          </span>
          <button
            type="button"
            className="save-error-dismiss"
            onClick={() => setSaveStatus('idle')}
            data-testid="btn-dismiss-save-error"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="workspace-body">
        {/* Left Side Panel: Blocks & Layers */}
        <aside
          className="workspace-sidebar"
          aria-label="Components and Layers"
          data-testid="workspace-sidebar-left"
        >
          <div className="panel-header">
            <span>Palette</span>
            <div className="panel-tab-toggle" role="tablist" aria-label="Left panel tabs">
              <button
                type="button"
                role="tab"
                aria-selected={activeLeftPanel === 'blocks'}
                className={`device-btn ${activeLeftPanel === 'blocks' ? 'active' : ''}`}
                onClick={() => setActiveLeftPanel('blocks')}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                data-testid="tab-blocks"
              >
                Blocks
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeLeftPanel === 'layers'}
                className={`device-btn ${activeLeftPanel === 'layers' ? 'active' : ''}`}
                onClick={() => setActiveLeftPanel('layers')}
                style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                data-testid="tab-layers"
              >
                Layers
              </button>
            </div>
          </div>

          {/* Mount points for GrapesJS BlockManager & LayerManager */}
          <div className="panel-scroll-container">
            <div
              id="blocks-panel-mount"
              className="panel-body blocks-panel"
              data-testid="blocks-container"
              style={{ display: activeLeftPanel === 'blocks' ? 'block' : 'none' }}
              onClick={(e) => {
                const target = e.target as HTMLElement | null;
                const title = target?.closest('.gjs-title');
                if (title) {
                  const category = title.closest('.gjs-block-category');
                  if (category) {
                    setTimeout(() => {
                      const blocksC = category.querySelector('.gjs-blocks-c') as HTMLElement | null;
                      if (blocksC && (blocksC.style.display === 'none' || !category.classList.contains('gjs-open'))) {
                        category.classList.remove('gjs-open');
                        blocksC.style.display = 'none';
                      } else if (blocksC) {
                        category.classList.add('gjs-open');
                        blocksC.style.display = '';
                      }
                    }, 20);
                  }
                }
              }}
            />
            <div
              id="layers-panel-mount"
              className="panel-body layers-panel"
              data-testid="layers-container"
              style={{ display: activeLeftPanel === 'layers' ? 'block' : 'none' }}
            />
          </div>
        </aside>

        {/* Center Canvas Host */}
        <EditorCanvasHost device={currentDevice} />

        {/* Right Side Panel: Style & Attributes Inspector */}
        <aside
          className="workspace-inspector"
          aria-label="Styles and Attributes"
          data-testid="workspace-sidebar-right"
        >
          <div id="styles-panel-mount" style={{ display: 'none' }} data-testid="styles-container" />
          <InspectorPanel />
        </aside>
      </div>

      {/* Status Bar */}
      <footer className="workspace-footer" role="contentinfo">
        <div className="status-indicator">
          <span
            className={`status-dot ${
              saveStatus === 'saving'
                ? 'saving'
                : saveStatus === 'error'
                  ? 'error'
                  : isDirty
                    ? 'dirty'
                    : ''
            }`}
            aria-hidden="true"
            data-testid="status-dot"
          />
          <span data-testid="status-text">
            {saveStatus === 'saving'
              ? 'Saving project...'
              : saveStatus === 'error'
                ? `Save failed: ${saveErrorMessage || 'Storage error'}`
                : isDirty
                  ? 'Unsaved changes'
                  : lastSavedAt
                    ? `Saved at ${lastSavedAt}`
                    : 'All changes saved'}
          </span>
        </div>
        <div className="status-meta">
          {selectedComponent && (
            <span className="status-selection">
              Selected: <code>&lt;{selectedComponent.tagName}&gt;</code>
            </span>
          )}
          <span>
            Viewport:{' '}
            <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {currentDevice}
            </strong>
          </span>
        </div>
      </footer>

      {/* Modals */}
      <ImportModal />
      <ExportModal />
      <ProjectListModal />
      <TemplatesModal />
    </div>
  );
}
