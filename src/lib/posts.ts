export type PostKind = "standard" | "transform";

/** User-created post categories (goal celebrations are system-only). */
export type PostCategory =
  | "fit_check"
  | "pump_check"
  | "meal_prep"
  | "weight_check"
  | "motivation"
  | "achievement"
  | "transformation";

/** Composer selection ids — includes system-only goal_completed (not postable). */
export type ComposerTypeId = PostCategory | "goal_completed";

export const CAPTION_MAX_LENGTH = 500;

export type ComposerTypeOption = {
  id: ComposerTypeId;
  label: string;
  description: string;
  kind: PostKind | null;
  category: PostCategory | null;
  /** System-generated only — shown in UI but not selectable. */
  auto?: boolean;
};

export const COMPOSER_TYPE_OPTIONS: ComposerTypeOption[] = [
  {
    id: "fit_check",
    label: "Fit check",
    description: "Show your physique progress.",
    kind: "standard",
    category: "fit_check"
  },
  {
    id: "pump_check",
    label: "Pump check",
    description: "Post your post-workout pump.",
    kind: "standard",
    category: "pump_check"
  },
  {
    id: "meal_prep",
    label: "Meal prep",
    description: "Share your healthy meals.",
    kind: "standard",
    category: "meal_prep"
  },
  {
    id: "weight_check",
    label: "Weight check",
    description: "Track your weight updates.",
    kind: "standard",
    category: "weight_check"
  },
  {
    id: "transformation",
    label: "Before / After",
    description: "Two photos. Your transformation.",
    kind: "transform",
    category: "transformation"
  },
  {
    id: "achievement",
    label: "Achievement",
    description: "Share your milestones & PRs.",
    kind: "standard",
    category: "achievement"
  },
  {
    id: "motivation",
    label: "Motivation",
    description: "Share a quote on a ready background.",
    kind: "standard",
    category: "motivation"
  },
  {
    id: "goal_completed",
    label: "Goal completed",
    description: "Automatically posted when you hit a goal.",
    kind: null,
    category: null,
    auto: true
  }
];

export function categoryLabel(category: PostCategory): string {
  if (category === "transformation") return "Before / After";
  return (
    COMPOSER_TYPE_OPTIONS.find((option) => option.id === category)?.label ??
    category
  );
}

export function resolveComposerType(
  id: ComposerTypeId
): ComposerTypeOption | undefined {
  return COMPOSER_TYPE_OPTIONS.find((option) => option.id === id);
}
