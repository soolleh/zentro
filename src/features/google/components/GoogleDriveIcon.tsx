/**
 * GoogleDriveIcon.tsx
 *
 * Inline SVG of the Google Drive logo (triangle shape, three segments).
 * Inline because Zentro is offline-first — no external icon CDN can be assumed.
 */

type GoogleDriveIconProps = {
  size?: number;
};

export function GoogleDriveIcon({ size = 24 }: GoogleDriveIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Blue segment — left column of triangle */}
      <path d="M8.267 3L2 14l3.267 5.667L11.533 8.667z" fill="#4285F4" />
      {/* Green segment — top-right area */}
      <path d="M15.733 3H8.267l3.266 5.667h7.467z" fill="#34A853" />
      {/* Yellow segment — right column */}
      <path d="M22 14L15.733 3l-3.267 5.667L18.733 19.667z" fill="#FBBC05" />
      {/* Bottom fill connecting all three */}
      <path d="M5.267 19.667h13.466L15.467 14H8.533z" fill="#4285F4" opacity="0.3" />
    </svg>
  );
}
