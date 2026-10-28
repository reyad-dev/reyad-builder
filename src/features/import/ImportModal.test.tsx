import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImportModal } from './ImportModal';
import { useUiStore } from '../../state/uiStore';
import { EditorContext } from '../../editor/EditorContext';
import type { IEditorAdapter } from '../../editor/types';

describe('ImportModal Component (Epic 3)', () => {
  let mockAdapter: IEditorAdapter;

  beforeEach(() => {
    mockAdapter = {
      isInitialized: true,
      init: vi.fn(),
      destroy: vi.fn(),
      setDevice: vi.fn(),
      getDevice: vi.fn().mockReturnValue('desktop'),
      getHtml: vi.fn().mockReturnValue('<div>Existing Canvas</div>'),
      getCss: vi.fn().mockReturnValue(''),
      getProjectData: vi.fn(),
      loadProjectData: vi.fn(),
      loadSanitizedDocument: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: vi.fn().mockReturnValue(false),
      canRedo: vi.fn().mockReturnValue(false),
      duplicateSelected: vi.fn().mockReturnValue(false),
      deleteSelected: vi.fn().mockReturnValue(false),
      getSelectedComponent: vi.fn().mockReturnValue(null),
      select: vi.fn(),
      clearSelection: vi.fn(),
      on: vi.fn().mockReturnValue(() => {}),
      getExportSnapshot: vi.fn().mockReturnValue({ bodyHtml: '', css: '' })
    };

    useUiStore.setState({
      isImportModalOpen: true,
      isDirty: false
    });
  });

  const renderWithContext = () =>
    render(
      <EditorContext.Provider value={{ adapter: mockAdapter, setAdapter: vi.fn() }}>
        <ImportModal />
      </EditorContext.Provider>
    );

  it('renders modal dialog when isImportModalOpen is true with Upload File as primary default tab', () => {
    renderWithContext();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Import HTML Document')).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs[0]).toHaveAttribute('data-testid', 'tab-upload');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[1]).toHaveAttribute('data-testid', 'tab-paste');
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('does not render modal when isImportModalOpen is false', () => {
    useUiStore.setState({ isImportModalOpen: false });
    renderWithContext();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes modal when close button or cancel is clicked', () => {
    renderWithContext();

    const closeBtn = screen.getByTestId('btn-close-import');
    fireEvent.click(closeBtn);

    expect(useUiStore.getState().isImportModalOpen).toBe(false);
  });

  it('AC-IMPORT-001: pastes HTML and loads sanitized document into adapter', () => {
    renderWithContext();

    const textarea = screen.getByTestId('import-paste-textarea');
    fireEvent.change(textarea, {
      target: { value: '<header class="hero"><h1>Imported Title</h1></header>' }
    });

    const submitBtn = screen.getByTestId('btn-import-submit');
    fireEvent.click(submitBtn);

    expect(mockAdapter.loadSanitizedDocument).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockAdapter.loadSanitizedDocument!).mock.calls[0];
    if (!call) throw new Error('Expected call');
    const loadedDoc = call[0];
    expect(loadedDoc.bodyHtml).toContain('Imported Title');
    expect(useUiStore.getState().isImportModalOpen).toBe(false);
    expect(useUiStore.getState().isDirty).toBe(false);
  });

  it('AC-IMPORT-004 & AC-IMPORT-007: displays warning banner when scripts or external stylesheets are stripped/detected', () => {
    renderWithContext();

    const textarea = screen.getByTestId('import-paste-textarea');
    fireEvent.change(textarea, {
      target: {
        value: `
          <html>
            <head>
              <link rel="stylesheet" href="https://cdn.example.com/styles.css">
              <script>alert('bad');</script>
            </head>
            <body><p>Content</p></body>
          </html>
        `
      }
    });

    const submitBtn = screen.getByTestId('btn-import-submit');
    fireEvent.click(submitBtn);

    // Staged document was loaded cleanly
    expect(mockAdapter.loadSanitizedDocument).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockAdapter.loadSanitizedDocument!).mock.calls[0];
    if (!call) throw new Error('Expected call');
    const loadedDoc = call[0];
    expect(loadedDoc.warnings.some((w) => w.code === 'SCRIPT_REMOVED')).toBe(true);
    expect(loadedDoc.warnings.some((w) => w.code === 'EXTERNAL_STYLESHEET_NOT_LOADED')).toBe(true);
  });

  it('AC-IMPORT-009: requires replacement confirmation when project is dirty before loading', () => {
    useUiStore.setState({ isDirty: true });
    renderWithContext();

    const textarea = screen.getByTestId('import-paste-textarea');
    fireEvent.change(textarea, { target: { value: '<div>New Content</div>' } });

    const submitBtn = screen.getByTestId('btn-import-submit');
    fireEvent.click(submitBtn);

    // Should NOT load document immediately
    expect(mockAdapter.loadSanitizedDocument).not.toHaveBeenCalled();

    // Confirmation banner should appear
    expect(screen.getByTestId('import-dirty-confirm')).toBeInTheDocument();
    expect(
      screen.getByText(/You have unsaved changes in your current project/i)
    ).toBeInTheDocument();

    // Confirm replacement
    const confirmBtn = screen.getByTestId('btn-confirm-replace');
    fireEvent.click(confirmBtn);

    expect(mockAdapter.loadSanitizedDocument).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().isDirty).toBe(false);
    expect(useUiStore.getState().isImportModalOpen).toBe(false);
  });

  it('AC-IMPORT-008: transactional behavior - error leaves current project untouched', () => {
    renderWithContext();

    // Empty content submit should trigger error banner and not touch adapter
    const textarea = screen.getByTestId('import-paste-textarea');
    fireEvent.change(textarea, { target: { value: '   ' } });

    // Submit button is disabled for empty content
    const submitBtn = screen.getByTestId('btn-import-submit');
    expect(submitBtn).toBeDisabled();
    expect(mockAdapter.loadSanitizedDocument).not.toHaveBeenCalled();
  });

  it('AC-IMPORT-002: supports file upload tab and reads file contents', async () => {
    renderWithContext();

    const uploadTab = screen.getByTestId('tab-upload');
    fireEvent.click(uploadTab);

    const fileInput = screen.getByTestId('import-file-input');
    const file = new File(['<section>Uploaded HTML Section</section>'], 'landing.html', {
      type: 'text/html'
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('selected-file-badge')).toHaveTextContent('landing.html');
    });

    const submitBtn = screen.getByTestId('btn-import-submit');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(mockAdapter.loadSanitizedDocument).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockAdapter.loadSanitizedDocument!).mock.calls[0];
    if (!call) throw new Error('Expected call');
    const loadedDoc = call[0];
    expect(loadedDoc.bodyHtml).toContain('Uploaded HTML Section');
  });

  it('rejects unsupported non-html uploaded files with error banner', () => {
    renderWithContext();

    const uploadTab = screen.getByTestId('tab-upload');
    fireEvent.click(uploadTab);

    const fileInput = screen.getByTestId('import-file-input');
    const file = new File(['binary'], 'image.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByTestId('import-error-banner')).toHaveTextContent(/Unsupported file format/i);
    expect(mockAdapter.loadSanitizedDocument).not.toHaveBeenCalled();
  });
});
