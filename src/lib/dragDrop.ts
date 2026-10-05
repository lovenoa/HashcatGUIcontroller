type PathDropTarget = {
  id: number;
  element: HTMLInputElement;
  onChange: (path: string) => void;
};

type DropPosition = {
  x: number;
  y: number;
};

const targets = new Map<number, PathDropTarget>();
let nextTargetId = 1;
let activeTarget: PathDropTarget | null = null;

function clearHover() {
  for (const element of document.querySelectorAll(".path-drop.dragging")) {
    element.classList.remove("dragging");
  }
}

function targetAt(position: DropPosition): PathDropTarget | null {
  const ratio = window.devicePixelRatio || 1;
  const x = position.x / ratio;
  const y = position.y / ratio;
  let match: PathDropTarget | null = null;
  let matchArea = Number.POSITIVE_INFINITY;

  for (const target of targets.values()) {
    if (!target.element.isConnected) continue;
    const rect = target.element.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;

    const area = rect.width * rect.height;
    if (area < matchArea) {
      match = target;
      matchArea = area;
    }
  }

  return match;
}

function setHoverAt(position: DropPosition) {
  clearHover();
  const target = targetAt(position);
  target?.element.closest(".path-drop")?.classList.add("dragging");
  activeTarget = target;
}

export function registerPathDropTarget(
  element: HTMLInputElement,
  onChange: (path: string) => void
): () => void {
  const id = nextTargetId++;
  targets.set(id, { id, element, onChange });
  return () => {
    targets.delete(id);
    if (activeTarget?.id === id) activeTarget = null;
  };
}

export function setPathDropTarget(element: HTMLInputElement | null, onChange?: (path: string) => void) {
  if (!element || !onChange) {
    activeTarget = null;
    clearHover();
    return;
  }

  const match = [...targets.values()].find((target) => target.element === element)
    ?? { id: nextTargetId++, element, onChange };
  targets.set(match.id, match);
  activeTarget = match;
  element.closest(".path-drop")?.classList.add("dragging");
}

export function acceptDroppedPath(path: string, position?: DropPosition) {
  const target = activeTarget ?? (position ? targetAt(position) : null);
  if (!target || !path) return;

  target.onChange(path);
  activeTarget = null;
  clearHover();
}

export async function initTauriDragDrop(): Promise<() => void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return () => undefined;
  }

  try {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    return await getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over" || event.payload.type === "enter") {
        setHoverAt(event.payload.position);
        return;
      }

      if (event.payload.type === "drop") {
        const path = event.payload.paths[0] ?? "";
        acceptDroppedPath(path, event.payload.position);
        return;
      }

      activeTarget = null;
      clearHover();
    });
  } catch {
    return () => undefined;
  }
}
