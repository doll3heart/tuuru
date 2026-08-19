export function buildPrecacheAssetList(bundle?: Record<string, unknown>): string[]

export function buildPrecacheVersion(assets: string[]): string

export function injectServiceWorkerPrecache(
  source: string,
  assets: string[],
  version?: string,
): string

export function tuuruServiceWorkerPrecache(): {
  name: string
  apply: "build"
  writeBundle(
    outputOptions: { dir?: string },
    bundle: Record<string, unknown>,
  ): Promise<void>
}
