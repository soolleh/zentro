import { create } from 'zustand';
import { generateUUID } from '@/services/crypto/crypto.utils';

export type Toast = {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
};

type ResolvedTheme = 'light' | 'dark';
type Theme = 'light' | 'dark' | 'system';

type UIState = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  sidebarOpen: boolean;
  activeModal: string | null;
  toasts: Toast[];
};

type UIActions = {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
};

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyThemeClass(resolved: ResolvedTheme): void {
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  theme: 'system',
  resolvedTheme: resolveTheme('system'),
  sidebarOpen: true,
  activeModal: null,
  toasts: [],

  setTheme(theme) {
    const resolved = resolveTheme(theme);
    applyThemeClass(resolved);
    set({ theme, resolvedTheme: resolved });
  },

  toggleSidebar() {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  openModal(id) {
    set({ activeModal: id });
  },

  closeModal() {
    set({ activeModal: null });
  },

  addToast(toast) {
    const id = generateUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
  },

  removeToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
