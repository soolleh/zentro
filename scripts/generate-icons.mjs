/**
 * Generates all required PWA icon sizes from icon-source.svg using sharp.
 * Run: pnpm generate-icons
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ICONS_DIR = join(ROOT, 'public', 'icons');
const SCREENSHOTS_DIR = join(ROOT, 'public', 'screenshots');

mkdirSync(ICONS_DIR, { recursive: true });
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const sourceSvg = readFileSync(join(ICONS_DIR, 'icon-source.svg'));

// Standard sizes
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

console.log('Generating app icons from icon-source.svg…');

for (const size of sizes) {
  // For maskable sizes (192, 512), add 10% padding on each side
  const isMaskable = size === 192 || size === 512;

  if (isMaskable) {
    // Render the SVG at 80% of the target size, then pad to full size
    const innerSize = Math.round(size * 0.8);
    const pad = Math.round((size - innerSize) / 2);

    await sharp(sourceSvg)
      .resize(innerSize, innerSize)
      .extend({
        top: pad,
        bottom: size - innerSize - pad,
        left: pad,
        right: size - innerSize - pad,
        background: { r: 8, g: 145, b: 178, alpha: 1 }, // #0891b2
      })
      .png()
      .toFile(join(ICONS_DIR, `icon-${String(size)}.png`));
  } else {
    await sharp(sourceSvg)
      .resize(size, size)
      .png()
      .toFile(join(ICONS_DIR, `icon-${String(size)}.png`));
  }

  console.log(`  ✓ icon-${String(size)}.png`);
}

// Shortcut: add (plus symbol on cyan background)
const addSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="18" fill="#0891b2"/>
  <line x1="48" y1="24" x2="48" y2="72" stroke="white" stroke-width="8" stroke-linecap="round"/>
  <line x1="24" y1="48" x2="72" y2="48" stroke="white" stroke-width="8" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(addSvg)).resize(96, 96).png().toFile(join(ICONS_DIR, 'shortcut-add.png'));
console.log('  ✓ shortcut-add.png');

// Shortcut: dashboard (grid on cyan background)
const dashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="18" fill="#0891b2"/>
  <rect x="20" y="20" width="24" height="24" rx="4" fill="white"/>
  <rect x="52" y="20" width="24" height="24" rx="4" fill="white"/>
  <rect x="20" y="52" width="24" height="24" rx="4" fill="white"/>
  <rect x="52" y="52" width="24" height="24" rx="4" fill="white"/>
</svg>`;

await sharp(Buffer.from(dashSvg))
  .resize(96, 96)
  .png()
  .toFile(join(ICONS_DIR, 'shortcut-dashboard.png'));
console.log('  ✓ shortcut-dashboard.png');

// Placeholder screenshots (1280×720 wide, 390×844 narrow)
const wideSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0891b2"/>
  <rect x="40" y="40" width="1200" height="640" rx="16" fill="#f8fafc" opacity="0.12"/>
  <text x="640" y="380" font-family="sans-serif" font-size="56" font-weight="bold"
        fill="white" text-anchor="middle" dominant-baseline="middle">Zentro</text>
</svg>`;

await sharp(Buffer.from(wideSvg))
  .resize(1280, 720)
  .png()
  .toFile(join(SCREENSHOTS_DIR, 'dashboard.png'));
console.log('  ✓ screenshots/dashboard.png');

const narrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844">
  <rect width="390" height="844" fill="#0891b2"/>
  <rect x="20" y="60" width="350" height="724" rx="16" fill="#f8fafc" opacity="0.12"/>
  <text x="195" y="422" font-family="sans-serif" font-size="42" font-weight="bold"
        fill="white" text-anchor="middle" dominant-baseline="middle">Zentro</text>
</svg>`;

await sharp(Buffer.from(narrowSvg))
  .resize(390, 844)
  .png()
  .toFile(join(SCREENSHOTS_DIR, 'transactions.png'));
console.log('  ✓ screenshots/transactions.png');

console.log('\nAll assets generated successfully.');

// Apple touch icon (same as 192)
await sharp(sourceSvg)
  .resize(180, 180)
  .png()
  .toFile(join(ROOT, 'public', 'apple-touch-icon.png'));
console.log('  ✓ apple-touch-icon.png (180px)');

// Screenshot placeholders
const dashScreenshot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#0891b2"/>
  <text x="640" y="380" font-family="system-ui,sans-serif" font-size="72" font-weight="700" fill="white" text-anchor="middle">Zentro</text>
</svg>`;

const txScreenshot = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844">
  <rect width="390" height="844" fill="#0891b2"/>
  <text x="195" y="440" font-family="system-ui,sans-serif" font-size="48" font-weight="700" fill="white" text-anchor="middle">Zentro</text>
</svg>`;

await sharp(Buffer.from(dashScreenshot))
  .resize(1280, 720)
  .png()
  .toFile(join(SCREENSHOTS_DIR, 'dashboard.png'));
console.log('  ✓ screenshots/dashboard.png');

await sharp(Buffer.from(txScreenshot))
  .resize(390, 844)
  .png()
  .toFile(join(SCREENSHOTS_DIR, 'transactions.png'));
console.log('  ✓ screenshots/transactions.png');

// favicon.ico placeholder
writeFileSync(
  join(ROOT, 'public', 'favicon.ico'),
  readFileSync(join(ICONS_DIR, 'icon-source.svg'))
);
console.log('\n✅ All icons generated successfully!');
