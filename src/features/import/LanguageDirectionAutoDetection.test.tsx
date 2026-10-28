import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportModal } from './ImportModal';
import { useUiStore } from '../../state/uiStore';
import { EditorContext } from '../../editor/EditorContext';
import type { IEditorAdapter } from '../../editor/types';

describe('Auto-Detection for Document Language and Direction (Arabic RTL vs English LTR)', () => {
  let mockAdapter: IEditorAdapter;

  beforeEach(() => {
    mockAdapter = {
      isInitialized: true,
      init: vi.fn(),
      destroy: vi.fn(),
      setDevice: vi.fn(),
      getDevice: vi.fn().mockReturnValue('desktop'),
      getHtml: vi.fn().mockReturnValue(''),
      getCss: vi.fn().mockReturnValue(''),
      getProjectData: vi.fn(),
      loadProjectData: vi.fn(),
      loadSanitizedDocument: vi.fn(),
      setDirection: vi.fn(),
      getDirection: vi.fn().mockReturnValue('rtl'),
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
      isDirty: false,
      currentDirection: 'rtl'
    });
  });

  const renderModal = () =>
    render(
      <EditorContext.Provider value={{ adapter: mockAdapter, setAdapter: vi.fn() }}>
        <ImportModal />
      </EditorContext.Provider>
    );

  it('automatically detects Arabic content, sets RTL direction, and displays Arabic badge', () => {
    renderModal();

    const textarea = screen.getByTestId('import-paste-textarea');
    fireEvent.change(textarea, {
      target: {
        value: `
          <section>
            <h1>أهلاً ومرحباً بكم</h1>
            <p>هذا النص تجريبي باللغة العربية للتحقق من الاتجاه.</p>
          </section>
        `
      }
    });

    // Check detection badge
    const badge = screen.getByTestId('detected-direction-pill');
    expect(badge).toHaveTextContent(/محتوى عربي \(RTL\)/i);
    expect(badge).toHaveClass('arabic');

    // Check that RTL radio is checked
    const rtlRadio = screen.getByTestId('radio-dir-rtl') as HTMLInputElement;
    expect(rtlRadio.checked).toBe(true);

    // Submit import
    const submitBtn = screen.getByTestId('btn-import-submit');
    fireEvent.click(submitBtn);

    expect(mockAdapter.loadSanitizedDocument).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockAdapter.loadSanitizedDocument!).mock.calls[0];
    if (!call) throw new Error('Expected call');
    expect(call[0].dir).toBe('rtl');
    expect(call[0].lang).toBe('ar');
    expect(mockAdapter.setDirection).toHaveBeenCalledWith('rtl');
    expect(useUiStore.getState().currentDirection).toBe('rtl');
  });

  it('automatically detects English content, sets LTR direction, and displays English badge', () => {
    renderModal();

    const textarea = screen.getByTestId('import-paste-textarea');
    fireEvent.change(textarea, {
      target: {
        value: `
          <section class="hero-banner">
            <h1>Welcome to Our Product</h1>
            <p>Build responsive web applications with ease and precision.</p>
          </section>
        `
      }
    });

    // Check detection badge
    const badge = screen.getByTestId('detected-direction-pill');
    expect(badge).toHaveTextContent(/English \/ LTR/i);
    expect(badge).toHaveClass('english');

    // Check that LTR radio is checked
    const ltrRadio = screen.getByTestId('radio-dir-ltr') as HTMLInputElement;
    expect(ltrRadio.checked).toBe(true);

    // Submit import
    const submitBtn = screen.getByTestId('btn-import-submit');
    fireEvent.click(submitBtn);

    expect(mockAdapter.loadSanitizedDocument).toHaveBeenCalledTimes(1);
    const call = vi.mocked(mockAdapter.loadSanitizedDocument!).mock.calls[0];
    if (!call) throw new Error('Expected call');
    expect(call[0].dir).toBe('ltr');
    expect(call[0].lang).toBe('en');
    expect(mockAdapter.setDirection).toHaveBeenCalledWith('ltr');
    expect(useUiStore.getState().currentDirection).toBe('ltr');
  });

  it('allows the user to manually override the detected direction', () => {
    renderModal();

    const textarea = screen.getByTestId('import-paste-textarea');
    fireEvent.change(textarea, {
      target: {
        value: '<h1>English heading here</h1>'
      }
    });

    // Initially detected as LTR
    const ltrRadio = screen.getByTestId('radio-dir-ltr') as HTMLInputElement;
    expect(ltrRadio.checked).toBe(true);

    // User chooses to force RTL
    const rtlRadio = screen.getByTestId('radio-dir-rtl') as HTMLInputElement;
    fireEvent.click(rtlRadio);
    expect(rtlRadio.checked).toBe(true);

    // Submit import
    const submitBtn = screen.getByTestId('btn-import-submit');
    fireEvent.click(submitBtn);

    const call = vi.mocked(mockAdapter.loadSanitizedDocument!).mock.calls[0];
    if (!call) throw new Error('Expected call');
    expect(call[0].dir).toBe('rtl');
    expect(mockAdapter.setDirection).toHaveBeenCalledWith('rtl');
    expect(useUiStore.getState().currentDirection).toBe('rtl');
  });
});
