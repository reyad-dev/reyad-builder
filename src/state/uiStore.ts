import { create } from 'zustand';
import { type SelectedComponentInfo } from '../editor/types';
import {
  createDefaultSourceMeta,
  generateProjectId,
  type ProjectSourceMeta,
} from '../data/projects/schema';

export type ViewportDevice = 'desktop' | 'tablet' | 'mobile';
export type ActiveLeftPanel = 'blocks' | 'layers';
export type ActiveRightPanel = 'styles' | 'attributes';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UiState {
  currentDevice: ViewportDevice;
  activeLeftPanel: ActiveLeftPanel;
  activeRightPanel: ActiveRightPanel;
  isImportModalOpen: boolean;
  isExportModalOpen: boolean;
  isProjectsModalOpen: boolean;
  isTemplatesModalOpen: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  saveErrorMessage: string | null;
  lastSavedAt: string | null;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  selectedComponent: SelectedComponentInfo | null;
  currentDirection: 'rtl' | 'ltr';

  // Project Identity State
  currentProjectId: string;
  currentProjectName: string;
  currentProjectCreatedAt: string;
  currentSourceMeta: ProjectSourceMeta;

  setDevice: (device: ViewportDevice) => void;
  setCurrentDirection: (dir: 'rtl' | 'ltr') => void;
  setActiveLeftPanel: (panel: ActiveLeftPanel) => void;
  setActiveRightPanel: (panel: ActiveRightPanel) => void;
  setImportModalOpen: (open: boolean) => void;
  setExportModalOpen: (open: boolean) => void;
  setProjectsModalOpen: (open: boolean) => void;
  setTemplatesModalOpen: (open: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setSaveStatus: (status: SaveStatus, errorMessage?: string | null) => void;
  setLastSavedAt: (timestamp: string | null) => void;
  setIsDirty: (dirty: boolean) => void;
  setCanUndo: (canUndo: boolean) => void;
  setCanRedo: (canRedo: boolean) => void;
  setSelectedComponent: (info: SelectedComponentInfo | null) => void;

  setProjectName: (name: string) => void;
  addExternalStylesheets: (urls: string[]) => void;
  setCurrentProject: (meta: {
    id: string;
    name: string;
    createdAt?: string;
    sourceMeta?: ProjectSourceMeta;
  }) => void;
  resetProjectState: (name?: string) => void;
}

export const useUiStore = create<UiState>((set) => {
  const initialId = generateProjectId();
  const initialNow = new Date().toISOString();

  return {
    currentDevice: 'desktop',
    activeLeftPanel: 'blocks',
    activeRightPanel: 'styles',
    isImportModalOpen: false,
    isExportModalOpen: false,
    isProjectsModalOpen: false,
    isTemplatesModalOpen: false,
    isSaving: false,
    saveStatus: 'idle',
    saveErrorMessage: null,
    lastSavedAt: null,
    isDirty: false,
    canUndo: false,
    canRedo: false,
    selectedComponent: null,
    currentDirection: 'rtl',

    currentProjectId: initialId,
    currentProjectName: 'Untitled Project',
    currentProjectCreatedAt: initialNow,
    currentSourceMeta: createDefaultSourceMeta('blank'),

    setDevice: (device) => set({ currentDevice: device }),
    setCurrentDirection: (dir) =>
      set((state) => ({
        currentDirection: dir,
        isDirty: true,
        currentSourceMeta: {
          ...state.currentSourceMeta,
          importedDir: dir,
        },
      })),
    setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),
    setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),
    setImportModalOpen: (open) => set({ isImportModalOpen: open }),
    setExportModalOpen: (open) => set({ isExportModalOpen: open }),
    setProjectsModalOpen: (open) => set({ isProjectsModalOpen: open }),
    setTemplatesModalOpen: (open) => set({ isTemplatesModalOpen: open }),
    setIsSaving: (saving) =>
      set((state) => ({
        isSaving: saving,
        saveStatus: saving ? 'saving' : 'idle',
        saveErrorMessage: saving ? null : state.saveErrorMessage,
      })),
    setSaveStatus: (status, errorMessage = null) =>
      set({
        saveStatus: status,
        isSaving: status === 'saving',
        saveErrorMessage: errorMessage,
      }),
    setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),
    setIsDirty: (dirty) => set({ isDirty: dirty }),
    setCanUndo: (canUndo) => set({ canUndo }),
    setCanRedo: (canRedo) => set({ canRedo }),
    setSelectedComponent: (info) => set({ selectedComponent: info }),

    setProjectName: (name) => set({ currentProjectName: name.trim() || 'Untitled Project', isDirty: true }),
    addExternalStylesheets: (urls) =>
      set((state) => {
        const existing = state.currentSourceMeta.externalStylesheets || [];
        const additions = urls.filter((url) => url && !existing.includes(url));
        if (additions.length === 0) {
          return {};
        }
        return {
          currentSourceMeta: {
            ...state.currentSourceMeta,
            externalStylesheets: [...existing, ...additions],
          },
        };
      }),
    setCurrentProject: (meta) =>
      set((state) => ({
        currentProjectId: meta.id,
        currentProjectName: meta.name,
        currentProjectCreatedAt: meta.createdAt || state.currentProjectCreatedAt,
        currentSourceMeta: meta.sourceMeta || state.currentSourceMeta,
        currentDirection: meta.sourceMeta?.importedDir === 'ltr' ? 'ltr' : 'rtl',
        isDirty: false,
        saveStatus: 'saved',
        saveErrorMessage: null,
      })),
    resetProjectState: (name = 'Untitled Project') => {
      const now = new Date().toISOString();
      set({
        currentProjectId: generateProjectId(),
        currentProjectName: name.trim() || 'Untitled Project',
        currentProjectCreatedAt: now,
        currentSourceMeta: createDefaultSourceMeta('blank'),
        currentDirection: 'rtl',
        isDirty: false,
        saveStatus: 'idle',
        saveErrorMessage: null,
        lastSavedAt: null,
      });
    },
  };
});
