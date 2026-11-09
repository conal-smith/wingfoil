import { useEffect } from "react";

/**
 * The focus ring is for the keyboard. A browser shows it on whatever holds
 * the focus as soon as any key is pressed, so a card clicked a moment ago
 * would wear it the next time a modifier went down. A pressed control lets
 * the focus go again; pressed from the keyboard (`detail` 0) it keeps it,
 * and inside a dialog it keeps it too, where the focus has to stay.
 */
export function useClickLeavesNoRing() {
  useEffect(() => {
    const clicked = (e: MouseEvent) => {
      if (e.detail === 0) return;
      const target = e.target as Element | null;
      if (!target?.closest("button, a, summary")) return;
      if (target.closest('[role="dialog"], dialog')) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches("button, a, summary"))
        active.blur();
    };
    document.addEventListener("click", clicked);
    return () => document.removeEventListener("click", clicked);
  }, []);
}
