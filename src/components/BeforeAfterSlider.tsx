"use client";

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
  return (
    <div className={`before-after-slider${className ? ` ${className}` : ""}`}>
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
      <span className="before-after-slider-label before-after-slider-label--before">
        {beforeLabel}
      </span>
      <span className="before-after-slider-label before-after-slider-label--after">
        {afterLabel}
      </span>
    </div>
  );
}
