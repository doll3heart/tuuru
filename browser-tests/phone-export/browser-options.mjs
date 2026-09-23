// Test-only launch policy. SVG/canvas PNG text uses grayscale antialiasing;
// Linux Chromium's native screenshot can otherwise use LCD-colored edges.
// Match those paint modes without changing fonts, layout or raster thresholds.
export function phoneExportBrowserOptions(engine) {
  return engine === 'chromium'
    ? { headless:true, args:['--disable-lcd-text'] }
    : { headless:true }
}
