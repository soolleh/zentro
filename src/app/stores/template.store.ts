/**
 * template.store.ts
 *
 * Zustand store for the Templates module.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import type { TransactionTemplate } from '@/shared/types/template.types';
import { templateStorage } from '@/services/storage/template.storage';
import { useSessionStore } from '@/app/stores/session.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TemplateState = {
  readonly templates: TransactionTemplate[];
  readonly isLoading: boolean;
  readonly activeTemplate: TransactionTemplate | null;
  readonly isQuickUsePanelOpen: boolean;
  readonly isFormPanelOpen: boolean;
  readonly formMode: 'add' | 'edit';
};

type TemplateActions = {
  loadTemplates: (userId: UUID) => Promise<void>;
  openQuickUsePanel: (template: TransactionTemplate) => void;
  closeQuickUsePanel: () => void;
  openFormPanel: (mode: 'add' | 'edit', template?: TransactionTemplate) => void;
  closeFormPanel: () => void;
  addTemplateToList: (template: TransactionTemplate) => void;
  updateTemplateInList: (template: TransactionTemplate) => void;
  removeTemplateFromList: (templateId: UUID) => void;
  bumpTemplateToTop: (templateId: UUID) => void;
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: TemplateState = {
  templates: [],
  isLoading: false,
  activeTemplate: null,
  isQuickUsePanelOpen: false,
  isFormPanelOpen: false,
  formMode: 'add',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTemplateStore = create<TemplateState & TemplateActions>((set) => ({
  ...DEFAULTS,

  async loadTemplates(userId) {
    const key = useSessionStore.getState().derivedKey;
    if (!key) return;
    set({ isLoading: true });
    try {
      const result = await templateStorage.listTemplatesByUser(userId, key);
      if (result.success) {
        set({ templates: result.data });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  openQuickUsePanel(template) {
    set({ activeTemplate: template, isQuickUsePanelOpen: true });
  },

  closeQuickUsePanel() {
    set({ isQuickUsePanelOpen: false, activeTemplate: null });
  },

  openFormPanel(mode, template) {
    set({
      isFormPanelOpen: true,
      formMode: mode,
      activeTemplate: template ?? null,
    });
  },

  closeFormPanel() {
    set({ isFormPanelOpen: false, activeTemplate: null });
  },

  addTemplateToList(template) {
    set((s) => ({
      templates: [template, ...s.templates],
    }));
  },

  updateTemplateInList(template) {
    set((s) => ({
      templates: s.templates.map((t) => (t.id === template.id ? template : t)),
      activeTemplate: s.activeTemplate?.id === template.id ? template : s.activeTemplate,
    }));
  },

  removeTemplateFromList(templateId) {
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== templateId),
      activeTemplate: s.activeTemplate?.id === templateId ? null : s.activeTemplate,
      isQuickUsePanelOpen: s.activeTemplate?.id === templateId ? false : s.isQuickUsePanelOpen,
      isFormPanelOpen: s.activeTemplate?.id === templateId ? false : s.isFormPanelOpen,
    }));
  },

  bumpTemplateToTop(templateId) {
    const now = new Date().toISOString() as ISODateString;
    set((s) => {
      const idx = s.templates.findIndex((t) => t.id === templateId);
      if (idx < 0) return {};
      const updated = {
        ...s.templates[idx],
        lastUsedAt: now,
        useCount: s.templates[idx].useCount + 1,
      };
      const rest = s.templates.filter((t) => t.id !== templateId);
      return { templates: [updated, ...rest] };
    });
  },

  reset() {
    set(DEFAULTS);
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useTemplates() {
  return useTemplateStore(useShallow((s) => ({ templates: s.templates, isLoading: s.isLoading })));
}

export function useRecentTemplates(limit: number) {
  // Select only the templates array with shallow equality so Zustand doesn't
  // see a new reference on every render (which would cause an infinite loop).
  const templates = useTemplateStore(useShallow((s) => s.templates));
  const sorted = [...templates].sort((a, b) => {
    if (a.lastUsedAt !== null && b.lastUsedAt !== null) {
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    }
    if (a.lastUsedAt !== null) return -1;
    if (b.lastUsedAt !== null) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return sorted.slice(0, limit);
}

export function useTemplatePanel() {
  return useTemplateStore(
    useShallow((s) => ({
      isFormPanelOpen: s.isFormPanelOpen,
      formMode: s.formMode,
      activeTemplate: s.activeTemplate,
      openFormPanel: s.openFormPanel,
      closeFormPanel: s.closeFormPanel,
    }))
  );
}

export function useQuickUsePanel() {
  return useTemplateStore(
    useShallow((s) => ({
      isQuickUsePanelOpen: s.isQuickUsePanelOpen,
      activeTemplate: s.activeTemplate,
      openQuickUsePanel: s.openQuickUsePanel,
      closeQuickUsePanel: s.closeQuickUsePanel,
    }))
  );
}
