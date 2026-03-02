/**
 * BudgetDefaultsSection
 *
 * Global budget alert threshold setting — triggers a notification when a
 * category reaches this percentage of its allocated budget.
 */

import { BellDot } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsCard } from '../components/SettingsCard';
import { SettingsRow } from '../components/SettingsRow';
import { ThresholdSlider } from '../components/ThresholdSlider';
import { usePreferencesStore } from '@/app/preferences.store';

export function BudgetDefaultsSection() {
  const defaultAlertThreshold = usePreferencesStore((s) => s.defaultAlertThreshold);
  const updateAlertThreshold = usePreferencesStore((s) => s.updateAlertThreshold);

  return (
    <SettingsSection
      id="budget-defaults"
      title="Budget Defaults"
      description="Global defaults applied to all budget categories. Individual categories can override these."
    >
      <SettingsCard>
        <SettingsRow
          label="Alert Threshold"
          description="You'll be notified when a budget category reaches this usage level. Can be overridden per category."
          icon={BellDot}
          stacked
        >
          <div className="w-full pt-1">
            <ThresholdSlider
              id="global-alert-threshold"
              value={defaultAlertThreshold}
              onChange={updateAlertThreshold}
            />
          </div>
        </SettingsRow>
      </SettingsCard>
    </SettingsSection>
  );
}
