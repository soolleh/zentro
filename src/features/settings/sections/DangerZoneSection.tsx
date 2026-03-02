/**
 * DangerZoneSection
 *
 * Account deletion with password confirmation.
 */

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { SettingsSection } from '../components/SettingsSection';
import { SettingsRow } from '../components/SettingsRow';
import { DeleteAccountDialog } from '../components/DeleteAccountDialog';
import { deleteAccount } from '@/services/settings/settings.service';
import { useSessionStore } from '@/app/stores/session.store';
import { useUIStore } from '@/app/ui.store';
export function DangerZoneSection() {
  const [showDialog, setShowDialog] = useState(false);
  const currentUser = useSessionStore((s) => s.currentUser);
  const addToast = useUIStore((s) => s.addToast);

  async function handleDelete(password: string) {
    if (!currentUser) throw new Error('No active user session.');

    const result = await deleteAccount(currentUser.id, password);
    if (!result.success) {
      throw new Error(result.error.message);
    }

    addToast({ type: 'success', message: 'Account deleted.' });

    // Log out
    useSessionStore.getState().logout();
  }

  return (
    <SettingsSection
      id="danger-zone"
      title="Danger Zone"
      description="Actions here are permanent and cannot be undone."
    >
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 overflow-hidden">
        <SettingsRow
          label="Delete Account"
          description="Permanently delete your account and all financial data from this device. This cannot be undone."
          icon={TriangleAlert}
          control={
            <button
              onClick={() => { setShowDialog(true); }}
              className="rounded-lg border border-destructive text-destructive bg-transparent hover:bg-destructive hover:text-destructive-foreground px-3 py-2 text-sm font-medium transition-colors"
            >
              Delete Account
            </button>
          }
        />
      </div>

      <DeleteAccountDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onConfirm={handleDelete}
      />
    </SettingsSection>
  );
}
