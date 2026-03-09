/**
 * AccountAlertsSection.tsx
 *
 * Balance alerts section rendered inside the account detail panel.
 * Lists all configured alerts for the account with inline actions.
 */
import { useEffect, useRef, useState } from 'react';
import {
  BellOff,
  Plus,
  TrendingDown,
  TrendingUp,
  MoreHorizontal,
  Pencil,
  AlarmClock,
  Trash2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { UUID } from '@/shared/types/common.types';
import type { AccountAlert } from '@/shared/types/alert.types';
import { useAlertsForAccount, useAlertStore, useAlertForm } from '@/app/stores/alert.store';
import { alertStorage } from '@/services/storage/alert.storage';
import { useSessionStore } from '@/app/stores/session.store';
import { useCurrentUser } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { formatCurrency } from '@/shared/utils/currency.utils';
import { AlertForm } from './AlertForm';

type AccountAlertsSectionProps = {
  readonly accountId: UUID;
  readonly currency: string;
};

const MAX_ALERTS = 5;

// ---------------------------------------------------------------------------
// Mini three-dot menu
// ---------------------------------------------------------------------------

type AlertMenuProps = {
  alert: AccountAlert;
  onEdit: () => void;
  onSnooze: (hours: 1 | 4 | 24) => void;
  onDelete: () => void;
};

function AlertMenu({ alert, onEdit, onSnooze, onDelete }: AlertMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => { document.removeEventListener('mousedown', handleClick); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((p) => !p); }}
        className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors duration-150"
        aria-label="Alert options"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-8 z-50 min-w-[160px] rounded-xl border border-border bg-card shadow-lg overflow-hidden py-1"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted/40 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
            Edit
          </button>
          {alert.status !== 'snoozed' && (
            <>
              {([1, 4, 24] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  role="menuitem"
                  onClick={() => { setOpen(false); onSnooze(h); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted/40 transition-colors"
                >
                  <AlarmClock className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
                  Snooze {h.toString()}h
                </button>
              ))}
            </>
          )}
          <div className="my-1 border-t border-border/60" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-destructive hover:bg-destructive/8 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toggle switch (inline)
// ---------------------------------------------------------------------------

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => { onChange(!checked); }}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
        'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked ? 'bg-primary' : 'bg-input',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
        aria-hidden="true"
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Single alert row
// ---------------------------------------------------------------------------

type AlertRowProps = {
  enriched: ReturnType<typeof useAlertsForAccount>[number];
  onEdit: () => void;
  onSnooze: (hours: 1 | 4 | 24) => void;
  onDelete: () => void;
  onToggle: () => void;
};

function AlertRow({ enriched, onEdit, onSnooze, onDelete, onToggle }: AlertRowProps) {
  const { alert, isCurrentlyTriggered } = enriched;

  const isTriggered = isCurrentlyTriggered || alert.status === 'triggered';
  const isSnoozed = alert.status === 'snoozed';

  const label = alert.label
    ? alert.label
    : alert.condition === 'below'
      ? `Below ${formatCurrency(alert.threshold, alert.currency)}`
      : `Above ${formatCurrency(alert.threshold, alert.currency)}`;

  const snoozeDisplay =
    isSnoozed && alert.snoozeUntil
      ? `Snoozed until ${new Date(alert.snoozeUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : null;

  const lastTriggeredDisplay =
    alert.lastTriggeredAt
      ? `Last triggered ${formatDistanceToNow(new Date(alert.lastTriggeredAt), { addSuffix: true })}`
      : null;

  return (
    <div
      className={[
        'flex items-center gap-3 py-2.5 px-3 rounded-xl border',
        isTriggered
          ? 'border-amber-300/60 bg-amber-50/40'
          : 'border-border bg-background',
        !alert.isEnabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      {/* Condition icon */}
      <div
        className={[
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          alert.condition === 'below' ? 'bg-destructive/10' : 'bg-[hsl(155_65%_42%/0.1)]',
        ].join(' ')}
        aria-hidden
      >
        {alert.condition === 'below' ? (
          <TrendingDown className="w-4 h-4 text-destructive" />
        ) : (
          <TrendingUp className="w-4 h-4 text-[hsl(var(--chart-4))]" />
        )}
      </div>

      {/* Label + status */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{label}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {isTriggered && !isSnoozed && (
            <span className="h-4 px-1.5 rounded-full bg-amber-100 text-[10px] font-medium text-amber-700 inline-flex items-center">
              Triggered
            </span>
          )}
          {isSnoozed && snoozeDisplay && (
            <span className="h-4 px-1.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground inline-flex items-center">
              {snoozeDisplay}
            </span>
          )}
          {lastTriggeredDisplay && !isTriggered && (
            <span className="text-[10px] text-muted-foreground">{lastTriggeredDisplay}</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <Toggle
          checked={alert.isEnabled}
          onChange={onToggle}
          label={`${alert.isEnabled ? 'Disable' : 'Enable'} alert`}
        />
        <AlertMenu
          alert={alert}
          onEdit={onEdit}
          onSnooze={onSnooze}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function AccountAlertsSection({ accountId, currency }: AccountAlertsSectionProps) {
  const alertsForAccount = useAlertsForAccount(accountId);
  const { openEditForm, openAddForm } = useAlertForm();
  const snoozeAlert = useAlertStore((s) => s.snoozeAlert);
  const removeAlertFromList = useAlertStore((s) => s.removeAlertFromList);
  const toggleAlertEnabled = useAlertStore((s) => s.toggleAlertEnabled);
  const currentUser = useCurrentUser();
  const addToast = useUIStore((s) => s.addToast);
  const derivedKey = useSessionStore((s) => s.derivedKey);

  const alertCount = alertsForAccount.length;
  const atMax = alertCount >= MAX_ALERTS;

  async function handleDelete(alertId: UUID) {
    const result = await alertStorage.deleteAlert(alertId);
    if (result.success) {
      removeAlertFromList(alertId);
      addToast({ type: 'success', message: 'Alert deleted.' });
    } else {
      addToast({ type: 'error', message: 'Failed to delete alert.' });
    }
  }

  if (!currentUser || !derivedKey) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Balance Alerts
        </span>
        <div className="relative group">
          <button
            type="button"
            onClick={() => { if (!atMax) openAddForm(accountId); }}
            disabled={atMax}
            className="h-7 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            aria-label={atMax ? 'Maximum 5 alerts per account' : 'Add alert'}
          >
            <Plus className="w-3 h-3" aria-hidden />
            Add
          </button>
          {atMax && (
            <div className="absolute right-0 top-8 z-10 px-2 py-1 rounded-md bg-card border border-border shadow-sm text-[10px] text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
              Maximum 5 alerts per account
            </div>
          )}
        </div>
      </div>

      {/* Alert list */}
      {alertsForAccount.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <BellOff className="w-3.5 h-3.5 shrink-0" aria-hidden />
          No alerts set for this account.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alertsForAccount.map((ea) => (
            <AlertRow
              key={ea.alert.id}
              enriched={ea}
              onEdit={() => { openEditForm(ea.alert); }}
              onSnooze={(hours) => { void snoozeAlert(ea.alert.id, hours); }}
              onDelete={() => { void handleDelete(ea.alert.id); }}
              onToggle={() => { void toggleAlertEnabled(ea.alert.id); }}
            />
          ))}
        </div>
      )}

      {/* Alert form panel */}
      <AlertForm accountId={accountId} accountCurrency={currency} />
    </div>
  );
}
