import { useState, useRef } from 'react';
import { Pencil, Trash2, Repeat, Paperclip } from 'lucide-react';
import { CategoryIcon } from '@/shared/ui/CategoryIcon';
import { useDrag } from '@use-gesture/react';
import type { Transaction } from '@/shared/types/transaction.types';
import type { Category } from '@/shared/types/category.types';
import type { Account } from '@/shared/types/account.types';

type TransactionRowProps = {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function formatAmount(transaction: Transaction): string {
  const { type, amount } = transaction;
  if (type === 'Income') return `+$${amount.toFixed(2)}`;
  if (type === 'Transfer') return `→$${amount.toFixed(2)}`;
  return `$${amount.toFixed(2)}`;
}

function getAmountColor(type: Transaction['type']): string {
  if (type === 'Income') return 'text-[hsl(var(--chart-4))]';
  if (type === 'Transfer') return 'text-muted-foreground';
  return 'text-foreground';
}

const REVEAL_THRESHOLD = 80;
const ACTION_THRESHOLD = 160;

export function TransactionRow({
  transaction,
  category,
  account,
  onPress,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches;
  const initialTouchRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalRef = useRef<boolean | null>(null);

  const bind = useDrag(
    ({ first, last, movement: [mx], xy: [x, y], direction: [dx] }) => {
      if (!isMobile) return;

      if (first) {
        initialTouchRef.current = { x, y };
        isHorizontalRef.current = null;
        setIsDragging(true);
        return;
      }

      // Determine gesture direction on first move
      if (isHorizontalRef.current === null && initialTouchRef.current) {
        const absX = Math.abs(mx);
        const absY = Math.abs(y - initialTouchRef.current.y);
        if (absX > 8 || absY > 8) {
          isHorizontalRef.current = absX > absY;
        }
      }

      // Only handle horizontal swipes
      if (isHorizontalRef.current === false) {
        if (last) setIsDragging(false);
        return;
      }

      if (last) {
        setIsDragging(false);
        const absOffset = Math.abs(mx);
        if (absOffset >= ACTION_THRESHOLD && dx < 0) {
          // Swipe past action threshold — trigger delete (leftmost action)
          onDelete();
          setOffset(0);
        } else if (absOffset >= ACTION_THRESHOLD && dx > 0) {
          onEdit();
          setOffset(0);
        } else if (absOffset >= REVEAL_THRESHOLD && mx < 0) {
          // Reveal actions
          setOffset(-REVEAL_THRESHOLD);
        } else {
          // Snap back
          setOffset(0);
        }
        return;
      }

      // Only allow left swipe (negative mx)
      if (mx > 0) {
        setOffset(offset > 0 ? 0 : 0);
        return;
      }
      setOffset(Math.max(mx, -180));
    },
    {
      axis: 'x',
      filterTaps: true,
      preventScrollAxis: 'y',
    }
  );

  const handleRowClick = () => {
    if (Math.abs(offset) > 5) {
      setOffset(0);
      return;
    }
    onPress();
  };

  const truncate = (str: string, max: number) =>
    str.length > max ? str.slice(0, max) + '…' : str;

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons (behind the row) */}
      {isMobile && (
        <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
          <button
            type="button"
            onClick={() => { setOffset(0); onEdit(); }}
            className="bg-primary text-white px-5 flex items-center justify-center"
            aria-label="Edit transaction"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setOffset(0); onDelete(); }}
            className="bg-destructive text-white px-5 flex items-center justify-center"
            aria-label="Delete transaction"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Row content */}
      <div
        {...(isMobile ? bind() : {})}
        style={{
          transform: `translateX(${offset.toString()}px)`,
          transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={handleRowClick}
        className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 active:bg-muted/50 cursor-pointer transition-colors duration-150 border-b border-border/50 last:border-0 bg-background"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress(); }
        }}
      >
        {/* Category icon circle */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{
            backgroundColor: category ? `${category.color}26` : 'hsl(var(--muted))',
          }}
        >
          <CategoryIcon
            name={category?.icon}
            className="w-5 h-5"
            style={{ color: category?.color ?? 'hsl(var(--muted-foreground))' }}
            aria-hidden
          />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">
              {category?.name ?? 'Uncategorized'}
            </span>
            {transaction.recurringRuleId && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground whitespace-nowrap shrink-0">
                <Repeat className="w-2.5 h-2.5 inline" />
                Recurring
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground truncate">
              {account?.name ?? 'Unknown account'}
            </span>
            {transaction.notes && (
              <span className="text-xs text-muted-foreground">
                · {truncate(transaction.notes, 20)}
              </span>
            )}
            {transaction.receiptBlob && (
              <Paperclip className="w-3 h-3 text-muted-foreground ml-0.5 shrink-0" />
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <div className={`text-sm font-semibold tabular-nums ${getAmountColor(transaction.type)}`}>
            {formatAmount(transaction)}
          </div>
        </div>
      </div>
    </div>
  );
}
