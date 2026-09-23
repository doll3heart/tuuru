// Test-only launch policy. SVG/canvas PNG text uses grayscale antialiasing;
// Linux Chromium's native screenshot can otherwise use LCD-colored edges.
// Also disable headless font hinting: the DPR-2 page and SVG image can otherwise
// snap the same glyph outline to different grids on Linux. This is not a change
// to authored fonts, product layout or raster thresholds.
export function phoneExportBrowserOptions(engine) {
  return engine === 'chromium'
    ? { headless:true, args:['--disable-lcd-text', '--font-render-hinting=none'] }
    : { headless:true }
}
