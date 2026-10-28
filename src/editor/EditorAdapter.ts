import grapesjs, { type Editor } from 'grapesjs';
import {
  type EditorAdapterOptions,
  type EditorDevice,
  type EditorEventType,
  type ExportSnapshot,
  type IEditorAdapter,
  type SelectedComponentInfo
} from './types';
import { VIEWPORT_DEVICES } from './devices';
import { DEFAULT_BLOCKS } from './blocks';
import { DEFAULT_BLANK_HTML, DEFAULT_CANVAS_CSS } from './editorConfig';
import type { SanitizedDocument } from '../domain/document/types';
import { detectDocumentFonts, injectFontStylesheet } from '../domain/document/fontDetector';
import { createCustomCssParser } from '../domain/document/cssParser';
import { detectDocumentLanguageAndDirection } from '../domain/document/directionDetector';

const EXPANDED_GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600;700&family=Almarai:wght@400;700&family=Amiri:ital,wght@0,400;0,700;1,400&family=Cairo:wght@400;500;600;700&family=Changa:wght@400;600;700&family=El+Messiri:wght@400;600;700&family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Arabic:wght@400;600;700&family=Readex+Pro:wght@400;600;700&family=Rubik:wght@400;600;700&family=Tajawal:wght@400;500;700&display=swap';

export class EditorAdapter implements IEditorAdapter {
  private editor: Editor | null = null;
  private isInit = false;
  private currentDevice: EditorDevice = 'desktop';
  private currentDirection: 'rtl' | 'ltr' = 'rtl';
  private importedDocCss = '';
  private eventListeners: Map<EditorEventType, Set<() => void>> = new Map([
    ['selection:change', new Set()],
    ['history:change', new Set()],
    ['update', new Set()]
  ]);

  get isInitialized(): boolean {
    return this.isInit && this.editor !== null;
  }

  async init(options: EditorAdapterOptions): Promise<void> {
    if (this.isInit && this.editor) {
      return;
    }

    const isJsdom =
      typeof window !== 'undefined' &&
      (window.navigator.userAgent.includes('jsdom') || process.env.NODE_ENV === 'test');

    const config: Record<string, unknown> = {
      container: options.container,
      fromElement: false,
      height: '100%',
      width: '100%',
      panels: { defaults: [] },
      storageManager: false,
      deviceManager: {
        devices: VIEWPORT_DEVICES
      },
      blockManager: options.blocksContainer
        ? {
            appendTo: options.blocksContainer,
            blocks: DEFAULT_BLOCKS
          }
        : {
            blocks: DEFAULT_BLOCKS
          },
      canvas: {
        styles: [EXPANDED_GOOGLE_FONTS_URL],
        frameStyle: `
          body { background-color: #fff; }
          html, body { overflow-x: auto; overflow-y: auto; }
          ::-webkit-scrollbar { width: 11px; height: 11px; }
          ::-webkit-scrollbar-track { background: #f1f5f9; }
          ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 6px; border: 2px solid #f1f5f9; }
          ::-webkit-scrollbar-thumb:hover { background: #64748b; }
        `
      },
      headless: options.headless ?? isJsdom,
      parser: {
        parserCss: createCustomCssParser()
      }
    };

    if (options.layersContainer) {
      config.layerManager = {
        appendTo: options.layersContainer
      };
    }

    this.editor = grapesjs.init(config);
    this.isInit = true;

    // Apply canvas styling reset
    this.editor.addComponents(`<style>${DEFAULT_CANVAS_CSS}</style>`);

    // Lock and protect the root wrapper element from deletion/moving
    const wrapper = this.editor.getWrapper();
    if (wrapper) {
      wrapper.set({
        removable: false,
        copyable: false,
        draggable: false,
        badgable: false
      });
    }

    // Populate initial starter document if canvas has no components
    const existingComponents = this.editor.getComponents();
    if (existingComponents.length === 0) {
      this.editor.addComponents(DEFAULT_BLANK_HTML);
    }

    // Synchronize initial device
    this.setDevice(this.currentDevice);

    // Prevent Backspace from deleting canvas components inside GrapesJS Keymaps
    try {
      const keymaps = (
        this.editor as unknown as {
          Keymaps?: {
            remove?: (id: string) => void;
            add?: (id: string, keys: string, cmd: string) => void;
          };
        }
      ).Keymaps;
      if (keymaps?.remove && keymaps?.add) {
        keymaps.remove('core:component-delete');
        keymaps.add('core:component-delete', 'delete', 'core:component-delete');
      }
    } catch {
      // safe fallback
    }

    // Register GrapesJS core events
    this.editor.on('component:selected component:deselected', () => {
      this.emit('selection:change');
    });

    this.editor.on('undo redo', () => {
      this.emit('history:change');
    });

    this.editor.on('component:add component:remove component:update style:update', () => {
      this.emit('update');
      this.emit('history:change');
    });

    // Notify listeners of initial state
    this.emit('history:change');
    this.emit('selection:change');
  }

  destroy(): void {
    if (!this.editor) {
      return;
    }

    for (const listeners of this.eventListeners.values()) {
      listeners.clear();
    }

    try {
      this.editor.destroy();
    } catch {
      // Ignore teardown errors if already cleaned
    }

    this.editor = null;
    this.isInit = false;
  }

  setDevice(device: EditorDevice): void {
    this.currentDevice = device;
    if (this.editor) {
      try {
        this.editor.setDevice(device);
      } catch {
        // Fallback if device isn't yet registered
      }
    }
  }

  getDevice(): EditorDevice {
    return this.currentDevice;
  }

  setDirection(dir: 'rtl' | 'ltr'): void {
    this.currentDirection = dir;
    const isRtl = dir === 'rtl';

    const wrapper = this.editor?.getWrapper();
    if (wrapper) {
      wrapper.addAttributes({ dir });
      wrapper.addStyle({ direction: dir });
    }

    try {
      const canvas = (
        this.editor as unknown as {
          Canvas?: { getDocument?: () => Document; getBody?: () => HTMLElement };
        }
      ).Canvas;
      const canvasDoc = canvas?.getDocument?.();
      if (canvasDoc) {
        if (canvasDoc.documentElement) {
          canvasDoc.documentElement.setAttribute('dir', dir);
          if (isRtl && !canvasDoc.documentElement.getAttribute('lang')) {
            canvasDoc.documentElement.setAttribute('lang', 'ar');
          }
        }
        if (canvasDoc.body) {
          canvasDoc.body.setAttribute('dir', dir);
          canvasDoc.body.style.direction = dir;
        }
      }
    } catch {
      // safe fallback
    }

    this.emit('update');
  }

  getDirection(): 'rtl' | 'ltr' {
    return this.currentDirection;
  }

  getHtml(): string {
    return this.editor?.getHtml() || '';
  }

  getCss(): string {
    const editorCss = this.editor?.getCss() || '';
    if (this.importedDocCss && this.importedDocCss.trim()) {
      if (!editorCss || !editorCss.trim()) {
        return this.importedDocCss;
      }
      if (editorCss.includes(this.importedDocCss.trim().slice(0, 40))) {
        return editorCss;
      }
      return `${this.importedDocCss}\n\n${editorCss}`;
    }
    return editorCss;
  }

  getExportSnapshot(): ExportSnapshot {
    return {
      bodyHtml: this.getHtml(),
      css: this.getCss()
    };
  }

  getProjectData(): unknown {
    return this.editor?.getProjectData() ?? null;
  }

  loadProjectData(data: unknown): void {
    if (this.editor && data && typeof data === 'object') {
      this.editor.loadProjectData(data as Record<string, unknown>);
      this.emit('update');
      this.emit('history:change');
    }
  }

  resetToBlank(): void {
    if (!this.editor) {
      return;
    }
    this.importedDocCss = '';
    try {
      const canvas = (
        this.editor as unknown as {
          Canvas?: { getDocument?: () => Document };
        }
      ).Canvas;
      const canvasDoc = canvas?.getDocument?.();
      canvasDoc?.getElementById('imported-document-css')?.remove();
    } catch {
      // safe fallback
    }
    this.editor.setComponents(`<style>${DEFAULT_CANVAS_CSS}</style>${DEFAULT_BLANK_HTML}`);
    this.editor.select(undefined);
    try {
      this.editor.refresh();
      (this.editor as unknown as { Canvas?: { refresh?: () => void } }).Canvas?.refresh?.();
    } catch {
      // safe fallback
    }
    this.emit('update');
    this.emit('history:change');
  }

  loadTemplate(html: string, css?: string): void {
    if (!this.editor) {
      return;
    }
    this.importedDocCss = css || '';
    try {
      const canvas = (
        this.editor as unknown as {
          Canvas?: { getDocument?: () => Document };
        }
      ).Canvas;
      const canvasDoc = canvas?.getDocument?.();
      const existing = canvasDoc?.getElementById('imported-document-css');
      if (css && css.trim() && canvasDoc?.head) {
        let styleEl = existing as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = canvasDoc.createElement('style');
          styleEl.id = 'imported-document-css';
          canvasDoc.head.insertBefore(styleEl, canvasDoc.head.firstChild);
        }
        styleEl.textContent = `${DEFAULT_CANVAS_CSS}\n${css}`;
      } else {
        existing?.remove();
      }
    } catch {
      // safe fallback
    }
    const fullHtml = css
      ? `<style>${DEFAULT_CANVAS_CSS}\n${css}</style>${html}`
      : `<style>${DEFAULT_CANVAS_CSS}</style>${html}`;
    this.editor.setComponents(fullHtml);
    this.editor.select(undefined);
    try {
      this.editor.refresh();
      (this.editor as unknown as { Canvas?: { refresh?: () => void } }).Canvas?.refresh?.();
    } catch {
      // safe fallback
    }
    this.emit('update');
    this.emit('history:change');
  }

  loadSanitizedDocument(doc: SanitizedDocument): void {
    if (!this.editor) {
      return;
    }
    this.importedDocCss = doc.css || '';
    this.clearSelection();

    let targetDir: 'rtl' | 'ltr';
    if (doc.dir === 'rtl' || doc.dir === 'ltr') {
      targetDir = doc.dir;
    } else {
      const combined = `${doc.bodyHtml || ''} ${doc.css || ''}`;
      const detected = detectDocumentLanguageAndDirection(combined);
      targetDir = detected.direction;
    }
    this.currentDirection = targetDir;
    const isRtl = targetDir === 'rtl';

    // Natural RTL without forcing !important on text-align or inner layouts
    const rtlCanvasCss = isRtl
      ? `\nhtml[dir="rtl"], body[dir="rtl"] {\n  direction: rtl;\n}\n`
      : '';

    const fullHtml =
      doc.css && doc.css.trim()
        ? `<style>${DEFAULT_CANVAS_CSS}${rtlCanvasCss}\n${doc.css}</style>${doc.bodyHtml || ''}`
        : `<style>${DEFAULT_CANVAS_CSS}${rtlCanvasCss}</style>${doc.bodyHtml || ''}`;
    this.editor.setComponents(fullHtml);

    this.setDirection(targetDir);

    const wrapper = this.editor.getWrapper();
    if (wrapper) {
      wrapper.set({
        removable: false,
        copyable: false,
        draggable: false,
        badgable: false
      });
      wrapper.addAttributes({ dir: targetDir });
      wrapper.addStyle({ direction: targetDir });
    }

    try {
      const canvas = (
        this.editor as unknown as {
          Canvas?: { getDocument?: () => Document; getBody?: () => HTMLElement };
        }
      ).Canvas;
      const canvasDoc = canvas?.getDocument?.();
      if (canvasDoc) {
        if (canvasDoc.documentElement) {
          canvasDoc.documentElement.setAttribute('dir', targetDir);
          if (doc.lang) {
            canvasDoc.documentElement.setAttribute('lang', doc.lang);
          } else if (isRtl) {
            canvasDoc.documentElement.setAttribute('lang', 'ar');
          }
        }
        if (canvasDoc.body) {
          canvasDoc.body.setAttribute('dir', targetDir);
          canvasDoc.body.style.direction = targetDir;
        }

        // Auto-inject external Google font stylesheets into canvas iframe
        for (const sheetUrl of doc.externalStylesheets || []) {
          if (sheetUrl.includes('fonts.googleapis.com')) {
            injectFontStylesheet(sheetUrl, canvasDoc);
          }
        }

        // Auto-detect fonts in doc and inject any known Google Fonts
        const detected = detectDocumentFonts(
          doc.bodyHtml || '',
          doc.css || '',
          doc.externalStylesheets || []
        );
        for (const font of detected) {
          if (font.googleFontsUrl) {
            injectFontStylesheet(font.googleFontsUrl, canvasDoc);
          }
        }

        // Auto-inject imported document CSS directly into canvas iframe head
        // to preserve CSS variables (:root), shorthands with var(), and complex selectors
        if (doc.css && doc.css.trim()) {
          let styleEl = canvasDoc.getElementById(
            'imported-document-css'
          ) as HTMLStyleElement | null;
          if (!styleEl) {
            styleEl = canvasDoc.createElement('style');
            styleEl.id = 'imported-document-css';
            canvasDoc.head.insertBefore(styleEl, canvasDoc.head.firstChild);
          }
          styleEl.textContent = `${DEFAULT_CANVAS_CSS}${rtlCanvasCss}\n${doc.css}`;
        } else {
          canvasDoc.getElementById('imported-document-css')?.remove();
        }
      }
    } catch {
      // safe fallback
    }

    if (this.editor.UndoManager) {
      this.editor.UndoManager.clear();
    }

    try {
      this.editor.refresh();
      (this.editor as unknown as { Canvas?: { refresh?: () => void } }).Canvas?.refresh?.();
    } catch {
      // safe fallback
    }

    this.emit('update');
    this.emit('history:change');
    this.emit('selection:change');
  }

  undo(): void {
    if (this.editor?.UndoManager) {
      this.editor.UndoManager.undo();
      this.emit('history:change');
      this.emit('update');
    }
  }

  redo(): void {
    if (this.editor?.UndoManager) {
      this.editor.UndoManager.redo();
      this.emit('history:change');
      this.emit('update');
    }
  }

  canUndo(): boolean {
    if (!this.editor?.UndoManager) {
      return false;
    }
    return Boolean(this.editor.UndoManager.hasUndo());
  }

  canRedo(): boolean {
    if (!this.editor?.UndoManager) {
      return false;
    }
    return Boolean(this.editor.UndoManager.hasRedo());
  }

  duplicateSelected(): boolean {
    if (!this.editor) {
      return false;
    }
    const selected = this.editor.getSelected();
    if (!selected) {
      return false;
    }

    const wrapper = this.editor.getWrapper();
    if (selected === wrapper || selected.get('copyable') === false) {
      return false;
    }

    const parent = selected.parent();
    if (!parent) {
      return false;
    }

    const index = selected.index();
    const clone = selected.clone();
    parent.append(clone, { at: index + 1 });
    this.editor.select(clone);

    this.emit('update');
    this.emit('history:change');
    return true;
  }

  deleteSelected(): boolean {
    if (!this.editor) {
      return false;
    }
    const selected = this.editor.getSelected();
    if (!selected) {
      return false;
    }

    const wrapper = this.editor.getWrapper();
    if (selected === wrapper || selected.get('removable') === false) {
      return false;
    }

    selected.remove();
    this.editor.select(undefined);

    this.emit('update');
    this.emit('history:change');
    return true;
  }

  getSelectedComponent(): SelectedComponentInfo | null {
    if (!this.editor) {
      return null;
    }

    const selected = this.editor.getSelected();
    if (!selected) {
      return null;
    }

    const wrapper = this.editor.getWrapper();
    if (selected === wrapper) {
      return null;
    }

    const classesRaw = selected.getClasses?.() || [];
    const classes: string[] = classesRaw
      .map((c: unknown) => {
        if (typeof c === 'string') return c;
        if (typeof c === 'object' && c !== null && 'name' in c) {
          return String((c as { name?: unknown }).name || '');
        }
        return '';
      })
      .filter((c: string) => c.length > 0);

    const tagName = (selected.get('tagName') || 'div').toLowerCase();
    const name = selected.getName?.() || selected.get('name') || tagName;

    return {
      id: selected.getId?.() || '',
      tagName,
      name: String(name),
      classes,
      isRemovable: selected.get('removable') !== false,
      isCopyable: selected.get('copyable') !== false
    };
  }

  select(component: unknown): void {
    if (this.editor && component) {
      this.editor.select(component as Parameters<Editor['select']>[0]);
    }
  }

  clearSelection(): void {
    if (this.editor) {
      this.editor.select(undefined);
    }
  }

  on(event: EditorEventType, callback: () => void): () => void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }
    return () => {
      listeners?.delete(callback);
    };
  }

  private emit(event: EditorEventType): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener();
        } catch {
          // Prevent listener exceptions from breaking editor flow
        }
      }
    }
  }
}
