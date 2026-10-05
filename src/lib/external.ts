export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external", { url });
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}
