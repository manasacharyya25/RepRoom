"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { LIVE_IMAGES } from "@/lib/live-images";

const SHARE_CARDS = [
  {
    id: "transform",
    eyebrow: "Transformations",
    title: "Share Your Progress",
    cta: "Share",
    href: "/feed",
    beforeImage: LIVE_IMAGES.transformBefore,
    afterImage: LIVE_IMAGES.transformAfter,
    variant: "transform" as const,
    subheading:
      "Before → after receipts. Drag the slider — flex on your future self."
  },
  {
    id: "fitcheck",
    eyebrow: "Fit checks",
    title: "Get Feedback",
    cta: "Post Form",
    href: "/feed",
    image: LIVE_IMAGES.fitCheck,
    variant: "single" as const,
    subheading:
      "Share your fit checks. Drop the mirror pic, collect the hype (and the form tips)."
  },
  {
    id: "mealprep",
    eyebrow: "Meal prep",
    title: "Fuel Your Body",
    cta: "Share Plate",
    href: "/feed",
    image: LIVE_IMAGES.mealPrep,
    variant: "single" as const,
    subheading:
      "Share your meal plans — kitchen gains count, and that Tupperware stack is a flex."
  },
  {
    id: "streaks",
    eyebrow: "Streaks & stats",
    title: "Stay Consistent",
    cta: "Update Stats",
    href: "/feed",
    variant: "stats" as const,
    subheading:
      "Log the streaks, weigh-ins, and ‘I showed up’ energy. Quiet consistency, loud results."
  },
  {
    id: "pump",
    eyebrow: "Pump checks",
    title: "Post the Pump",
    cta: "Post Pump",
    href: "/feed",
    image: LIVE_IMAGES.pumpCheck,
    variant: "single" as const,
    subheading:
      "Fresh out of the gym? Share the pump check before the swole tax hits."
  },
  {
    id: "crew",
    eyebrow: "Accountability",
    title: "Tag Your Crew",
    cta: "Find Crew",
    href: "/feed",
    image: LIVE_IMAGES.accountability,
    variant: "single" as const,
    subheading:
      "Call out your workout buddy. Peer pressure, but make it wholesome."
  },
  {
    id: "wins",
    eyebrow: "Daily wins",
    title: "Celebrate Wins",
    cta: "Share Win",
    href: "/feed",
    image: LIVE_IMAGES.dailyWin,
    variant: "single" as const,
    subheading:
      "Tiny wins still count. Posted the walk? Logged the stretch? We’re cheering."
  }
] as const;

const SIDE_COUNT = 3;
const SWIPE_THRESHOLD_PX = 48;

function cardOffset(index: number, active: number, total: number) {
  let delta = index - active;
  const half = Math.floor(total / 2);
  if (delta > half) delta -= total;
  if (delta < -half) delta += total;
  return delta;
}

export function FeedShareCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = SHARE_CARDS[activeIndex] ?? SHARE_CARDS[0];
  const swipeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const ordered = useMemo(
    () =>
      SHARE_CARDS.map((card, index) => ({
        card,
        index,
        offset: cardOffset(index, activeIndex, SHARE_CARDS.length)
      })),
    [activeIndex]
  );

  const goNext = useCallback(() => {
    setActiveIndex((index) => (index + 1) % SHARE_CARDS.length);
  }, []);

  const goPrev = useCallback(() => {
    setActiveIndex(
      (index) => (index - 1 + SHARE_CARDS.length) % SHARE_CARDS.length
    );
  }, []);

  const finishSwipe = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const swipe = swipeRef.current;
      if (!swipe || swipe.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - swipe.startX;
      const deltaY = event.clientY - swipe.startY;
      swipeRef.current = null;

      if (
        Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
        Math.abs(deltaX) <= Math.abs(deltaY)
      ) {
        return;
      }

      suppressClickRef.current = true;
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    },
    [goNext, goPrev]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      swipeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY
      };
    },
    []
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (swipeRef.current?.pointerId === event.pointerId) {
        swipeRef.current = null;
      }
    },
    []
  );

  return (
    <div className="share-carousel">
      <div className="share-carousel-copy">
        <h2>Share the work between workouts</h2>
        <p key={active.id} className="share-carousel-subhead">
          {active.subheading}
        </p>
      </div>

      <div
        className="share-carousel-stage"
        aria-roledescription="carousel"
        onPointerDown={onPointerDown}
        onPointerUp={finishSwipe}
        onPointerCancel={onPointerCancel}
      >
        <div className="share-carousel-track">
          {ordered.map(({ card, index, offset }) => {
            const isActive = offset === 0;
            const isVisible = Math.abs(offset) <= SIDE_COUNT;

            return (
              <article
                key={card.id}
                className={`share-carousel-card${isActive ? " is-active" : ""}${
                  isVisible ? "" : " is-hidden"
                }`}
                style={
                  {
                    "--share-offset": offset,
                    "--share-abs": Math.abs(offset),
                    zIndex: 20 - Math.abs(offset)
                  } as CSSProperties
                }
                aria-hidden={!isVisible}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${card.title}. ${card.subheading}`}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  if (!isActive) setActiveIndex(index);
                }}
              >
                <div
                  className={`share-carousel-media${
                    card.variant === "stats" ? " share-carousel-media--stats" : ""
                  }`}
                >
                  {card.variant === "transform" ? (
                    <div
                      className="share-carousel-transform"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      <BeforeAfterSlider
                        afterLabel="After"
                        afterSrc={card.afterImage}
                        beforeLabel="Before"
                        beforeSrc={card.beforeImage}
                        className="share-carousel-ba"
                      />
                    </div>
                  ) : null}

                  {card.variant === "single" && "image" in card && card.image ? (
                    <Image
                      alt=""
                      className="share-carousel-image"
                      fill
                      sizes="280px"
                      src={card.image}
                    />
                  ) : null}

                  {card.variant === "stats" ? (
                    <div className="share-carousel-stats" aria-hidden>
                      <span>🔥 21 day streak</span>
                      <span>⚖ −2.4 kg</span>
                      <span>🏅 PR week</span>
                      <span>📅 5 / 7</span>
                    </div>
                  ) : null}

                  <span className="share-carousel-tag">{card.eyebrow}</span>
                </div>

                <div className="share-carousel-body">
                  <strong>{card.title}</strong>
                  <Link
                    className="share-carousel-cta"
                    href={card.href}
                    tabIndex={isActive ? 0 : -1}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {card.cta}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="share-carousel-dots" role="tablist" aria-label="Share ideas">
        {SHARE_CARDS.map((card, index) => (
          <button
            key={card.id}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className={`share-carousel-dot${
              index === activeIndex ? " is-active" : ""
            }`}
            aria-label={card.title}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </div>
  );
}
