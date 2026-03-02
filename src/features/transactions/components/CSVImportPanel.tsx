import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, ChevronRight, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import type { UUID } from '@/shared/types/common.types';
import type { CSVColumnMapping, CSVImportResult } from '@/shared/types/transaction.types';
import { importFromCSV } from '@/services/transactions/transaction.service';
import { useShallow } from 'zustand/react/shallow';
import { useTransactionStore } from '@/app/stores/transaction.store';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
import { AccountSelector } from './AccountSelector';

type Step = 1 | 2 | 3;

const REQUIRED_MAPPINGS: (keyof CSVColumnMapping)[] = ['date', 'amount'];
const OPTIONAL_MAPPINGS: (keyof CSVColumnMapping)[] = ['type', 'category', 'notes'];

const FIELD_LABELS: Record<keyof CSVColumnMapping, string> = {
  date: 'Date',
  amount: 'Amount',
  type: 'Type',
  category: 'Category',
  notes: 'Notes',
};

type ParseResult = {
  headers: string[];
  rows: string[][];
  rawCsv: string;
};

type CSVImportPanelProps = {
  onClose: () => void;
};

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center py-1">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={[
            'h-1.5 rounded-full transition-all duration-200',
            current === step ? 'w-8 bg-primary' : 'w-2 bg-border',
          ].join(' ')}
        />
      ))}
    </div>
  );
}

export function CSVImportPanel({ onClose }: CSVImportPanelProps) {
  const { currentUser, derivedKey } = useSessionStore(
    useShallow((s) => ({ currentUser: s.currentUser, derivedKey: s.derivedKey }))
  );
  const loadTransactions = useTransactionStore((s) => s.loadTransactions);
  const addToast = useUIStore((s) => s.addToast);

  const [step, setStep] = useState<Step>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Partial<CSVColumnMapping>>({});
  const [accountId, setAccountId] = useState<UUID | null>(null);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawCsv = e.target?.result as string;
      const { data } = Papa.parse<string[]>(rawCsv, { skipEmptyLines: true });
      if (data.length < 2) {
        addToast({ type: 'error', message: 'CSV must have at least a header row and one data row.' });
        return;
      }
      const headers = data[0];
      const rows = data.slice(1);

      // Auto-detect column mapping by header name
      const autoMapping: Partial<CSVColumnMapping> = {};
      headers.forEach((h, i) => {
        const lower = h.toLowerCase().trim();
        if (lower.includes('date')) autoMapping.date = headers[i];
        else if (lower === 'amount' || lower.includes('amount')) autoMapping.amount = headers[i];
        else if (lower === 'type' || lower.includes('type')) autoMapping.type = headers[i];
        else if (lower.includes('categ')) autoMapping.category = headers[i];
        else if (lower.includes('note') || lower.includes('desc') || lower.includes('memo'))
          autoMapping.notes = headers[i];
      });
      setMapping(autoMapping);
      setParseResult({ headers, rows, rawCsv });
      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        parseFile(file);
      } else {
        addToast({ type: 'error', message: 'Please drop a CSV file.' });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addToast]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    if (!currentUser || !derivedKey || !parseResult || !accountId) return;
    if (!mapping.date || !mapping.amount) {
      addToast({ type: 'error', message: 'Date and Amount columns are required.' });
      return;
    }
    setIsImporting(true);
    setStep(3);

    const result = await importFromCSV(
      {
        userId: currentUser.id,
        accountId,
        csvString: parseResult.rawCsv,
        columnMapping: { date: mapping.date, amount: mapping.amount, ...mapping } as CSVColumnMapping,
      },
      derivedKey
    );

    setIsImporting(false);
    if (result.success) {
      setImportResult(result.data);
      // Reload transaction list
      void loadTransactions({ userId: currentUser.id, limit: 30, sortBy: 'date', sortOrder: 'desc' });
    } else {
      addToast({ type: 'error', message: 'CSV import failed.' });
    }
  };

  const canProceedToStep3 = mapping.date && mapping.amount && accountId;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">Import CSV</h2>
          <StepIndicator current={step} total={3} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Step 1: Drop zone */}
      {step === 1 && (
        <div className="flex flex-col gap-6 px-6 py-8">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Upload your CSV file</h3>
            <p className="text-sm text-muted-foreground">
              Export transactions from your bank, then upload here. First row must be a header row.
            </p>
          </div>
          <div
            onDragEnter={() => { setIsDragging(true); }}
            onDragLeave={() => { setIsDragging(false); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={handleFileDrop}
            onClick={() => { fileInputRef.current?.click(); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            className={[
              'w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-12 gap-3 cursor-pointer transition-all duration-150',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20',
            ].join(' ')}
          >
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center">
              <Upload className="w-7 h-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Drop CSV file here</p>
              <p className="text-xs text-muted-foreground mt-0.5">or click to browse files</p>
            </div>
            <span className="text-xs text-muted-foreground">Accepts .csv files</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: Column mapping */}
      {step === 2 && parseResult && (
        <div className="flex flex-col gap-5 px-6 py-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Map columns</h3>
            <p className="text-sm text-muted-foreground">
              Tell Zentro which column from your CSV corresponds to each field.
            </p>
          </div>

          {/* Account selector */}
          <AccountSelector
            value={accountId}
            onChange={(id) => { setAccountId(id); }}
            label="Import into account"
            error={!accountId ? undefined : undefined}
          />

          {/* Column mapping fields */}
          <div className="flex flex-col gap-3">
            {([...REQUIRED_MAPPINGS, ...OPTIONAL_MAPPINGS] as (keyof CSVColumnMapping)[]).map((field) => {
              const isRequired = REQUIRED_MAPPINGS.includes(field);
              return (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-24 text-sm font-medium text-foreground shrink-0">
                    {FIELD_LABELS[field]}
                    {isRequired && <span className="text-destructive ml-0.5">*</span>}
                  </label>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) => {
                      setMapping((prev) => ({
                        ...prev,
                        [field]: e.target.value || undefined,
                      }));
                    }}
                    className="flex-1 h-9 rounded-lg border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— not mapped —</option>
                    {parseResult.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          {/* Preview table */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Preview (first 3 rows)
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    {parseResult.headers.map((h) => (
                      <th key={h} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseResult.rows.slice(0, 3).map((row, ri) => (
                    <tr key={ri} className="border-t border-border">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2 text-foreground whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {parseResult.rows.length.toString()} total rows detected
            </p>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-card pt-2 pb-4">
            <button
              type="button"
              disabled={!canProceedToStep3}
              onClick={() => { void handleImport(); }}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 hover:bg-primary/90 disabled:opacity-50"
            >
              Import {parseResult.rows.length.toString()} transactions
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && (
        <div className="flex flex-col gap-6 px-6 py-8 items-center">
          {isImporting ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm font-medium text-foreground">Importing transactions…</p>
            </div>
          ) : importResult ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--chart-4)/0.12)] flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-[hsl(var(--chart-4))]" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-foreground mb-1">Import complete</h3>
                <p className="text-sm text-muted-foreground">
                  {importResult.created.toString()} of {importResult.total.toString()} transactions imported
                </p>
              </div>
              {/* Summary chips */}
              <div className="flex gap-2 flex-wrap justify-center">
                <span className="px-3 py-1 rounded-full bg-[hsl(var(--chart-4)/0.1)] text-[hsl(var(--chart-4))] text-xs font-medium">
                  {importResult.created.toString()} created
                </span>
                {importResult.skipped > 0 && (
                  <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    {importResult.skipped.toString()} skipped (duplicates)
                  </span>
                )}
                {importResult.errors.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                    {importResult.errors.length.toString()} errors
                  </span>
                )}
              </div>
              {/* Error list */}
              {importResult.errors.length > 0 && (
                <div className="w-full flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> Import errors
                  </p>
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 border-b border-destructive/10 last:border-0">
                        <span className="text-xs text-destructive font-medium shrink-0">Row {err.row.toString()}</span>
                        <span className="text-xs text-destructive">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors duration-150"
              >
                Done
              </button>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
