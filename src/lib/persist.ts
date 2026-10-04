/**
 * Asks the browser to keep this app's data when the phone runs low on space. Best effort: Safari
 * decides on its own and never asks the user, so a refusal or an error is ignored.
 */
export async function askToKeepData(): Promise<void> {
  try {
    const storage = navigator.storage
    if (typeof storage?.persist !== 'function') return
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return
    await storage.persist()
  } catch {
    // Nothing to do: the data is still saved, just not marked to keep.
  }
}
