// Test-only launch policy. SVG/canvas PNG text uses grayscale antialiasing;
// Linux Chromium's native screenshot can otherwise use LCD-colored edges.
// Linux also enables font subpixel positioning based on device scale factor;
// the DPR-2 page and embedded SVG image do not share that scale. Keep their
// positioning policy equal without changing product CSS or raster thresholds.
export function phoneExportBrowserOptions(engine) {
  return engine === 'chromium'
    ? { headless:true, args:['--disable-lcd-text', '--disable-font-subpixel-positioning'] }
    : { headless:true }
}
