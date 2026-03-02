/**
 * AppearanceSection
 *
 * Allows the user to switch between Light, Dark, and System (follows OS) themes.
 */

import { Sun, Moon, Monitor } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { SegmentedControl } from '../components/SegmentedControl';
import { usePreferencesStore } from '@/app/preferences.store';
import type { Theme } from '@/shared/types/settings.types';

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} aria-hidden="true" /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} aria-hidden="true" /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} aria-hidden="true" /> },
];

export function AppearanceSection() {
  const theme = usePreferencesStore((s) => s.theme);
  const updateTheme = usePreferencesStore((s) => s.updateTheme);

  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Choose how Zentro looks on this device."
    >
      <SettingsCard>
        <SettingsRow
          label="Theme"
          description="Light keeps it crisp. Dark is easier on the eyes at night. System follows your OS preference."
          control={
            <SegmentedControl
              value={theme}
              onChange={updateTheme}
              options={THEME_OPTIONS}
              ariaLabel="Select theme"
            />
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
