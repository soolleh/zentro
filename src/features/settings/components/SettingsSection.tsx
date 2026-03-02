/**
 * SettingsSection
 *
 * A labelled section container used in the Settings page. Each section receives
 * a unique `id` so the IntersectionObserver in SettingsPage can track which
 * section is active in the sidebar nav.
 */

type SettingsSectionProps = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
};

export function SettingsSection({
  id,
  title,
  description,
  children,
}: SettingsSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-6 scroll-mt-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          id={`${id}-heading`}
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
