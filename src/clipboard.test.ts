import { describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

function fixture(clipboard?: { writeText: (text: string) => Promise<void> }) {
  const range = { cloneRange: vi.fn(() => range) };
  const selection = { rangeCount: 1, getRangeAt: vi.fn(() => range), removeAllRanges: vi.fn(), addRange: vi.fn() };
  const previous = { tagName: "INPUT", isConnected: true, selectionStart: 2, selectionEnd: 5,
    selectionDirection: "backward", focus: vi.fn(), setSelectionRange: vi.fn() };
  const field = { value: "", readOnly: false, dir: "", tabIndex: 0, style: { cssText: "" },
    focus: vi.fn(), select: vi.fn(), setSelectionRange: vi.fn(), remove: vi.fn() };
  const page = { activeElement: previous, getSelection: () => selection, createElement: vi.fn(() => field),
    body: { appendChild: vi.fn() }, execCommand: vi.fn(() => true) };
  return { field, previous, range, selection, page,
    environment: { navigator: { clipboard } as Pick<Navigator, "clipboard">, document: page as unknown as Document } };
}

describe("safe exact-case clipboard writes", () => {
  const text = "NG-dX626jFL";
  it("uses the modern API without temporary DOM when it succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined), f = fixture({ writeText });
    await copyText(text, f.environment);
    expect(writeText).toHaveBeenCalledWith(text);
    expect(f.page.createElement).not.toHaveBeenCalled();
  });
  it.each(["absent", "rejected", "getter denied"])("falls back when the modern API is %s", async (mode) => {
    const f = fixture(mode === "rejected" ? { writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) } : undefined);
    if (mode === "getter denied") Object.defineProperty(f.environment.navigator, "clipboard", { get() { throw new Error("denied"); } });
    await copyText(text, f.environment);
    expect(f.field.value).toBe(text);
    expect(f.field.dir).toBe("ltr");
    expect(f.field.readOnly).toBe(true);
    expect(f.field.select).toHaveBeenCalledOnce();
    expect(f.field.setSelectionRange).toHaveBeenCalledWith(0, text.length);
    expect(f.page.execCommand).toHaveBeenCalledWith("copy");
    expect(f.field.remove).toHaveBeenCalledOnce();
    expect(f.previous.focus).toHaveBeenCalled();
    expect(f.previous.setSelectionRange).toHaveBeenCalledWith(2, 5, "backward");
    expect(f.selection.addRange).toHaveBeenCalledWith(f.range);
  });
  it.each(["false", "throw", "unsupported"])("rejects a failed legacy copy (%s) and always cleans up", async (mode) => {
    const f = fixture();
    if (mode === "false") f.page.execCommand.mockReturnValue(false);
    if (mode === "throw") f.page.execCommand.mockImplementation(() => { throw new Error("blocked"); });
    if (mode === "unsupported") Object.assign(f.page, { execCommand: undefined });
    const onSuccess = vi.fn();
    await expect(copyText(text, f.environment).then(onSuccess)).rejects.toThrow();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(f.field.remove).toHaveBeenCalledOnce();
    expect(f.previous.focus).toHaveBeenCalled();
  });
  it("supports older focus implementations without options", async () => {
    const f = fixture();
    f.field.focus.mockImplementationOnce(() => { throw new Error("options unsupported"); });
    await copyText(text, f.environment);
    expect(f.field.focus).toHaveBeenLastCalledWith();
  });
  it("does not turn a successful copy into failure when previous selection became stale", async () => {
    const f = fixture();
    f.selection.addRange.mockImplementation(() => { throw new Error("detached"); });
    await expect(copyText(text, f.environment)).resolves.toBeUndefined();
    expect(f.field.remove).toHaveBeenCalledOnce();
  });
});
