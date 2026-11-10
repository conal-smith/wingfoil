/**
 * The chart's loupe (force5/src/loupeDraw.ts, the same drawing the chart
 * uses) laid over a picture of the spot: a spot's satellite picture, or the
 * small one on the Spot finder's cards. The world outside the glass is
 * dimmed, the spot is a light at its middle, and the loupe is drawn in a
 * photo's own colours (force5/src/loupe.css `.is-photo`), the same in either
 * theme.
 *
 * It is laid over a frame `width` by `height` screen pixels, with the spot at
 * `cx`, `cy` and the rim of radius `r`. With `foot`, the reading in its box
 * under the rim, as on the chart. `small` is the cards' one: shapes, no words
 * or ticks, drawn at a hundred and shrunk to `r`.
 */
import { useId, useLayoutEffect, useRef } from "react";
import {
  LOUPE_BAND,
  type LoupeRose,
  type RoseScale,
} from "../../force5/src/focus";
import { drawFoot, drawLoupe, redraw } from "../../force5/src/loupeDraw";
import type { Rose } from "../../force5/src/rideWedge";
import { tv } from "../../ui/tv";

const styles = tv({
  slots: {
    svg: "loupe is-photo absolute inset-0 size-full overflow-hidden",
    light: "fill-photo-line stroke-photo-shade",
  },
  variants: {
    small: { true: { svg: "is-small" } },
  },
});

const f1 = (n: number) => Number(n.toFixed(1));

/** The small one is drawn at this radius and shrunk to its own. */
const SMALL = 100;

export function Loupe({
  width: W,
  height: H,
  cx,
  cy,
  r: R,
  loupe,
  faint,
  scale,
  small = false,
  foot = false,
  className,
}: {
  width: number;
  height: number;
  cx: number;
  cy: number;
  r: number;
  loupe: LoupeRose | null;
  /** Under the rider's floor: where they could sail, drawn faintly. */
  faint?: Rose | null;
  /** The rose's distances, when the picture is to scale; else null. */
  scale: RoseScale | null;
  small?: boolean;
  /** The reading in its box at the rim's foot. */
  foot?: boolean;
  className?: string;
}) {
  const id = `lp-${useId().replace(/[^\w-]/g, "")}`;
  const glass = useRef<SVGGElement>(null);
  const footBox = useRef<SVGGElement>(null);
  const s = styles({ small });
  const shown = faint ?? loupe?.rose ?? null;
  useLayoutEffect(() => {
    const g = glass.current;
    if (!g) return;
    redraw(g, () =>
      drawLoupe(g, small ? SMALL : R, small ? null : scale, loupe, {
        id,
        small,
        rose: { rose: shown, faint: !!faint },
      }),
    );
  });
  useLayoutEffect(() => {
    if (footBox.current) drawFoot(footBox.current, foot ? loupe : null);
  });
  return (
    <svg
      className={s.svg({ className })}
      viewBox={`0 0 ${f1(W)} ${f1(H)}`}
      aria-hidden="true"
      data-loupe={small ? "card" : "picture"}
      data-rose-faint={faint ? true : undefined}
    >
      <defs>
        <mask id={`${id}-m`}>
          <rect width={W} height={H} className="fill-photo-line" />
          <circle cx={cx} cy={cy} r={R} className="fill-photo-shade" />
        </mask>
      </defs>
      {/* The world outside the glass, dimmed. */}
      <rect width={W} height={H} className="loupe-dim" mask={`url(#${id}-m)`} />
      <g
        ref={glass}
        transform={`translate(${f1(cx)} ${f1(cy)})${small ? ` scale(${Number((R / SMALL).toFixed(3))})` : ""}`}
      />
      {/* The spot, a light in the middle of the glass. */}
      <circle
        cx={cx}
        cy={cy}
        r={small ? 3.5 : 4.5}
        className={s.light()}
        strokeWidth={2}
      />
      {foot && (
        <g transform={`translate(${f1(cx)} ${f1(cy + R + LOUPE_BAND / 2)})`}>
          <g ref={footBox} className="map-loupe-foot" />
        </g>
      )}
    </svg>
  );
}
