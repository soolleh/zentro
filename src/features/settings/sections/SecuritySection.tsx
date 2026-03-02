/**
 * SecuritySection
 *
 * Inactivity timeout and biometric authentication settings.
 */

import { Timer } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { BiometricSettings } from '../components/BiometricSettings';
import { usePreferencesStore } from '@/app/preferences.store';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const TIMEOUT_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1 minute' },
  { value: 2, label: '2 minutes' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 0, label: 'Never (not recommended)' },
];

const SELECT_CLASS = [
  'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'cursor-pointer appearance-none',
  'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238a9aa8\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")]',
  'bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem_1rem] pr-8',
].join(' ');

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SecuritySection() {
  const inactivityTimeoutMinutes = usePreferencesStore((s) => s.inactivityTimeoutMinutes);
  const updateInactivityTimeout = usePreferencesStore((s) => s.updateInactivityTimeout);

  return (
    <SettingsSection
      id="security"
      title="Security"
      description="Control how and when Zentro locks your data."
    >
      <SettingsCard>
        <SettingsRow
          label="Auto-lock Timeout"
          description="Zentro will lock after this period of inactivity. Your data requires re-authentication to access."
          icon={Timer}
          control={
            <select
              value={inactivityTimeoutMinutes}
              onChange={(e) => { updateInactivityTimeout(Number(e.target.value)); }}
              aria-label="Select auto-lock timeout"
              className={SELECT_CLASS}
            >
              {TIMEOUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          }
        />
      </SettingsCard>

      {/* Biometric authentication — self-contained component */}
      <BiometricSettings />
    </SettingsSection>
  );
}
