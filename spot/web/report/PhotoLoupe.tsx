/**
 * The chart's loupe (shared/web/Loupe.tsx) over a spot's satellite picture,
 * at high or low tide, with what it reads under it (`children`). The picture
 * is drawn as large as the loupe needs to show the rose whole, where a rider
 * can go and where they would drift, and to the picture's own scale, so the
 * rose's distances are true (satellite.ts `loupeFrame`).
 */
import type { LoupeRose, RoseScale } from "../../../force5/src/focus";
import type { Rose } from "../../../force5/src/rideWedge";
import { Loupe } from "../../../shared/web/Loupe";
import { useSize } from "../../../shared/web/useSize";
import { tv } from "../../../ui/tv";
import {
  lift,
  loupeFrame,
  type PictureTide,
  type SpotPicture,
} from "../satellite";

const styles = tv({
  slots: {
    root: "m-0 flex min-w-0 flex-col overflow-hidden rounded-surface bg-sunken on-card",
    photo:
      "relative h-72 w-full shrink-0 overflow-hidden bg-photo-shade wide:h-auto wide:min-h-72 wide:flex-1",
    img: "absolute max-w-none transition-opacity duration-base",
  },
});

export function PhotoLoupe({
  picture,
  tide,
  loupe,
  faint,
  scale,
  className,
  children,
}: {
  picture: SpotPicture;
  tide: PictureTide;
  loupe: LoupeRose | null;
  /** Under the rider's floor: where they could sail, drawn faintly. */
  faint?: Rose | null;
  scale: RoseScale;
  className?: string;
  children?: React.ReactNode;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const frame = size
    ? loupeFrame(picture, size.width, size.height, scale.metres)
    : null;
  const s = styles();
  return (
    <figure className={s.root({ className })} data-photo-loupe data-tide={tide}>
      <div ref={ref} className={s.photo()}>
        {frame &&
          (["high", "low"] as const).map((t) => (
            <img
              key={t}
              className={s.img({
                className: [
                  t === tide ? "opacity-100" : "opacity-0",
                  lift(picture),
                ],
              })}
              style={frame.image}
              src={picture.urls[t]}
              alt={
                t === tide
                  ? `From above at ${t} tide, north up, with the wind drawn over it.`
                  : ""
              }
              loading="lazy"
              decoding="async"
            />
          ))}
        {size && frame && (
          <Loupe
            width={size.width}
            height={size.height}
            cx={frame.cx}
            cy={frame.cy}
            r={frame.r}
            loupe={loupe}
            faint={faint}
            scale={scale}
          />
        )}
      </div>
      {children}
    </figure>
  );
}
