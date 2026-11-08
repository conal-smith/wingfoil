import { X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { DISABLED, RING, tv, type VariantProps } from "./tv";

/*
 * A choice you can press: a soft capsule, filled in ink when it is on. Never
 * in capitals. A word that only describes something is a Tag, not a Chip.
 *
 * `lit` is the map's layer chips alone (the ruling of 2026-11-07): off, a
 * ghost, no edge and no fill, its line icon and its word muted; on, it glows
 * in its layer's own colour (`glow`), a fifth of it for the fill, its edge and
 * its icon in that colour and its word in full ink. On is said by the fill and
 * the edge, never by the colour alone, and `aria-pressed` with them.
 */
export const chipStyles = tv({
  slots: {
    base: [
      "inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-well px-3",
      "font-body text-body font-medium whitespace-nowrap text-ink",
      "relative touch-manipulation transition-colors duration-fast",
      // A thumb's reach on a touch screen: a band to touch height across it,
      // so the row keeps its size and nothing around it moves.
      "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-1.5",
      "not-disabled:hover:bg-line",
      "aria-pressed:bg-inverse aria-pressed:text-ink-inverse not-disabled:aria-pressed:hover:bg-inverse",
      RING,
      DISABLED,
    ],
    remove: "-mr-1 opacity-60",
    icon: "inline-flex shrink-0",
  },
  variants: {
    variant: {
      soft: {},
      lit: {
        base: [
          "group border border-transparent bg-transparent pl-2.5 text-ink-muted",
          "not-disabled:hover:bg-well not-disabled:hover:text-ink-2 not-disabled:aria-pressed:hover:text-ink",
          "aria-pressed:text-ink motion-reduce:transition-none",
        ],
        icon: "transition-colors duration-fast motion-reduce:transition-none",
      },
    },
    glow: {
      none: {},
      wind: {
        base: "aria-pressed:border-glow-wind-edge aria-pressed:bg-glow-wind/20 not-disabled:aria-pressed:hover:bg-glow-wind/30",
        icon: "group-aria-pressed:text-glow-wind-ink",
      },
      waves: {
        base: "aria-pressed:border-glow-waves-edge aria-pressed:bg-glow-waves/20 not-disabled:aria-pressed:hover:bg-glow-waves/30",
        icon: "group-aria-pressed:text-glow-waves-ink",
      },
      weather: {
        base: "aria-pressed:border-glow-weather-edge aria-pressed:bg-glow-weather/20 not-disabled:aria-pressed:hover:bg-glow-weather/30",
        icon: "group-aria-pressed:text-glow-weather-ink",
      },
    },
  },
  defaultVariants: { variant: "soft", glow: "none" },
});

export type ChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-pressed" | "children"
> &
  VariantProps<typeof chipStyles> & {
    /** On, for a choice; omit it for a filter in use that a press takes away. */
    pressed?: boolean;
    /** A filter in use: the cross that says a press takes it away. */
    removable?: boolean;
    /** A small line icon before the word: a lit chip's, in its glow when on. */
    icon?: ReactNode;
    children: ReactNode;
    ref?: Ref<HTMLButtonElement>;
  };

/** A choice in a row of them, or a filter in use that a press clears. */
export function Chip({
  pressed,
  removable = false,
  variant,
  glow,
  icon,
  className,
  children,
  ...props
}: ChipProps) {
  const styles = chipStyles({ variant, glow });
  return (
    <button
      type="button"
      {...props}
      className={styles.base({ className })}
      aria-pressed={pressed}
    >
      {icon && (
        <span className={styles.icon()} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
      {removable && (
        <X className={styles.remove()} size={14} aria-hidden="true" />
      )}
    </button>
  );
}
