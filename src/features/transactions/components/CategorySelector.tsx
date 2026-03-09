import { useState, useEffect, useRef, useMemo } from 'react';
import { Check, ChevronDown, Search, Tag, Plus } from 'lucide-react';
import type { Category, FlatCategoryOption } from '@/shared/types/category.types';
import type { TransactionType } from '@/shared/types/transaction.types';
import type { UUID, ISODateString } from '@/shared/types/common.types';
import { categoryStorage } from '@/services/storage/category.storage';
import { buildCategoryTree, flattenCategoryTree } from '@/services/categories/category.service';
import { useDerivedKey, useCurrentUser } from '@/app/stores/session.store';
import { generateUUID } from '@/services/crypto/crypto.utils';

type CategorySelectorProps = {
  value: UUID | null;
  onChange: (categoryId: UUID) => void;
  transactionType?: TransactionType;
  label?: string;
  error?: string;
};

export function CategorySelector({
  value,
  onChange,
  transactionType,
  label = 'Category',
  error,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatOptions, setFlatOptions] = useState<FlatCategoryOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#0891b2');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const derivedKey = useDerivedKey();
  const currentUser = useCurrentUser();

  const loadCategories = () => {
    if (!currentUser || !derivedKey) return;
    void categoryStorage.listCategoriesByUser(currentUser.id, derivedKey).then(
      (result) => {
        if (result.success) {
          setCategories(result.data);
          const tree = buildCategoryTree(result.data);
          setFlatOptions(flattenCategoryTree(tree, transactionType));
        }
      }
    );
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, derivedKey]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setSearch('');
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => { document.removeEventListener('mousedown', handler); };
  }, [isOpen]);

  const filtered = useMemo(() => {
    let list = flatOptions;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) => o.label.toLowerCase().includes(q));
    }
    return list;
  }, [flatOptions, search]);

  const selectedOption = flatOptions.find((o) => o.category.id === value) ?? null;
  const selectedCategory = selectedOption?.category ?? null;

  const handleCreateCategory = () => {
    if (!currentUser || !derivedKey || !newCategoryName.trim()) return;
    const now = new Date().toISOString() as ISODateString;
    const newCat: Category = {
      id: generateUUID(),
      userId: currentUser.id,
      name: newCategoryName.trim(),
      icon: 'Tag',
      color: newCategoryColor,
      transactionType,
      isSystem: false,
      sortOrder: categories.length,
      createdAt: now,
    };
    void categoryStorage.createCategory(newCat, derivedKey).then((result) => {
      if (result.success) {
        setCategories((prev) => [...prev, result.data]);
        onChange(result.data.id);
        setIsCreating(false);
        setNewCategoryName('');
        setIsOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => { setIsOpen((o) => !o); }}
          className={`h-10 w-full rounded-lg border ${error ? 'border-destructive' : 'border-input'} bg-background px-3 text-sm flex items-center gap-2 text-left cursor-pointer transition-colors duration-150`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {selectedCategory ? (
            <>
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedCategory.color }}
              />
              <span className="flex-1 truncate text-foreground font-medium">
                {selectedOption?.label ?? selectedCategory.name}
              </span>
            </>
          ) : (
            <>
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 text-muted-foreground">Select category</span>
            </>
          )}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); }}
                  placeholder="Search categories…"
                  className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-44 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  No categories found
                </div>
              ) : (
                filtered.map((opt) => {
                  const isSubcat = opt.depth === 1;
                  return (
                    <button
                      key={opt.category.id}
                      type="button"
                      onClick={() => {
                        onChange(opt.category.id);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`flex items-center gap-2 w-full text-left hover:bg-muted/50 transition-colors duration-100 ${isSubcat ? 'pl-7 pr-3 py-2' : 'px-3 py-2.5'
                        }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: opt.category.color, opacity: isSubcat ? 0.75 : 1 }}
                      />
                      <span className={`text-sm flex-1 ${isSubcat ? 'text-muted-foreground' : 'font-medium text-foreground'
                        }`}>
                        {opt.category.name}
                      </span>
                      {opt.category.id === value && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* New Category */}
            <div className="border-t border-border p-2">
              {isCreating ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => { setNewCategoryName(e.target.value); }}
                    placeholder="Category name"
                    className="h-8 w-full rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); }
                      if (e.key === 'Escape') { setIsCreating(false); }
                    }}
                  />
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newCategoryColor}
                      onChange={(e) => { setNewCategoryColor(e.target.value); }}
                      className="h-8 w-8 rounded cursor-pointer border border-input"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      className="flex-1 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsCreating(false); }}
                      className="h-8 px-2 rounded-md border border-border text-xs text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setIsCreating(true); }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New category
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
