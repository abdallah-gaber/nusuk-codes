type CopyEnvironment = { navigator: Pick<Navigator, "clipboard">; document: Document };

/** Call from a user action. Never reads clipboard contents or normalizes the text. */
export async function copyText(text: string, environment: CopyEnvironment = { navigator, document }): Promise<void> {
  try {
    const clipboard = environment.navigator.clipboard;
    if (typeof clipboard?.writeText === "function") {
      await clipboard.writeText(text);
      return;
    }
  } catch { /* Embedded browsers may expose the API but deny access. */ }
  legacyCopy(text, environment.document);
}

function legacyCopy(text: string, page: Document) {
  const previous = page.activeElement as HTMLElement | null;
  const input = previous?.tagName === "INPUT" || previous?.tagName === "TEXTAREA"
    ? previous as HTMLInputElement | HTMLTextAreaElement : null;
  const inputSelection = input && input.selectionStart !== null
    ? { start: input.selectionStart, end: input.selectionEnd!, direction: input.selectionDirection || "none" as const }
    : null;
  const selection = page.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const field = page.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.dir = "ltr";
  field.tabIndex = -1;
  // Selectable (not display:none), fixed to avoid scrolling, 16px to avoid mobile zoom.
  field.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;font-size:16px";
  try {
    page.body.appendChild(field);
    try { field.focus({ preventScroll: true }); } catch { field.focus(); }
    field.select();
    field.setSelectionRange(0, text.length);
    // Deprecated compatibility fallback only; never interpret false/unsupported as success.
    if (typeof page.execCommand !== "function" || page.execCommand("copy") !== true)
      throw new Error("Clipboard unavailable");
  } finally {
    field.remove();
    try {
      if (previous?.isConnected) {
        try { previous.focus({ preventScroll: true }); } catch { previous.focus(); }
      }
      if (input && inputSelection) input.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction);
      if (selection) {
        selection.removeAllRanges();
        for (const range of ranges) selection.addRange(range);
      }
    } catch { /* Stale selection/focus must not mask the copy result. */ }
  }
}
