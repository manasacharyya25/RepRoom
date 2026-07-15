"use client";

import { useEffect, useState } from "react";
import {
  ReactCompareSlider,
  ReactCompareSliderImage
} from "react-compare-slider";

type BeforeAfterSliderProps = {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
  /** Initial handle position 0–100. */
  defaultPosition?: number;
};

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
  defaultPosition = 50
}: BeforeAfterSliderProps) {
  // react-compare-slider injects camelCase vs kebab-case inline styles
  // differently on server vs client — mount only after hydration.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={`before-after-slider${className ? ` ${className}` : ""}`}>
      {mounted ? (
        <ReactCompareSlider
          className="before-after-slider-root"
          defaultPosition={defaultPosition}
          itemOne={
            <ReactCompareSliderImage
              alt={beforeLabel}
              src={beforeSrc}
              style={{ objectFit: "cover" }}
            />
          }
          itemTwo={
            <ReactCompareSliderImage
              alt={afterLabel}
              src={afterSrc}
              style={{ objectFit: "cover" }}
            />
          }
        />
      ) : (
        <div
          aria-hidden
          className="before-after-slider-root before-after-slider-fallback"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="before-after-slider-fallback-img"
            src={afterSrc}
          />
          <div
            className="before-after-slider-fallback-before"
            style={{ width: `${defaultPosition}%` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={beforeSrc} />
          </div>
        </div>
      )}
      <span className="before-after-slider-label before-after-slider-label--before">
        {beforeLabel}
      </span>
      <span className="before-after-slider-label before-after-slider-label--after">
        {afterLabel}
      </span>
    </div>
  );
}
