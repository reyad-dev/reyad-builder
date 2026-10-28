import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplatesModal } from './TemplatesModal';
import { useUiStore } from '../../state/uiStore';
import { EditorContext } from '../../editor/EditorContext';
import type { IEditorAdapter } from '../../editor/types';

describe('TemplatesModal Component', () => {
  const mockAdapter: Partial<IEditorAdapter> = {
    loadTemplate: vi.fn(),
    resetToBlank: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      isTemplatesModalOpen: true,
      currentProjectId: 'test-proj',
      currentProjectName: 'Untitled Project',
      isDirty: false
    });
  });

  const renderModal = () =>
    render(
      <EditorContext.Provider
        value={{ adapter: mockAdapter as IEditorAdapter, setAdapter: vi.fn() }}
      >
        <TemplatesModal />
      </EditorContext.Provider>
    );

  it('renders modal dialog and template cards when open', () => {
    renderModal();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Starter Examples & Templates/i)).toBeInTheDocument();
    expect(screen.getByTestId('template-card-saas-landing')).toBeInTheDocument();
    expect(screen.getByTestId('template-card-personal-portfolio')).toBeInTheDocument();
  });

  it('filters templates when category tab is clicked', () => {
    renderModal();

    const portfolioTab = screen.getByTestId('tab-cat-portfolio');
    fireEvent.click(portfolioTab);

    expect(screen.getByTestId('template-card-personal-portfolio')).toBeInTheDocument();
    expect(screen.queryByTestId('template-card-saas-landing')).not.toBeInTheDocument();
  });

  it('calls adapter.loadTemplate and updates project on template selection', () => {
    renderModal();

    const applyBtn = screen.getByTestId('btn-apply-template-saas-landing');
    fireEvent.click(applyBtn);

    expect(mockAdapter.loadTemplate).toHaveBeenCalledWith(
      expect.stringContaining('builder-section'),
      undefined
    );
    expect(useUiStore.getState().currentProjectName).toBe('SaaS Product Landing Page');
    expect(useUiStore.getState().isDirty).toBe(true);
  });

  it('closes when close button is clicked', () => {
    renderModal();

    const closeBtn = screen.getByTestId('btn-close-templates');
    fireEvent.click(closeBtn);

    expect(useUiStore.getState().isTemplatesModalOpen).toBe(false);
  });
});
