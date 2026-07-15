export type WeightUnit = "kg" | "lbs";

export type GoalCategory = "consistency" | "performance" | "lifestyle";

export type GoalTemplateId =
  | "train_weekly"
  | "mobility_streak"
  | "lift_target"
  | "meal_prep"
  | "target_weight"
  | "hours_worked";

export type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  age_range: string | null;
  country_code: string | null;
  timezone: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  weight_unit: WeightUnit;
  instagram_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  website_url: string | null;
  onboarding_completed_at: string | null;
  plan: "free" | "premium";
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  template_id: GoalTemplateId | string;
  title: string;
  detail: string | null;
  category: GoalCategory | string;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
  progress: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ProfileViewModel = {
  profile: Profile;
  goals: Goal[];
  hoursWorked: number;
  hoursGoal: number;
  hoursProgress: number;
  dayStreak: number;
};

export type OnboardingGoalInput = {
  template_id: GoalTemplateId;
  title: string;
  detail: string;
  category: GoalCategory;
  current_value: number;
  target_value: number;
  unit: string;
  sort_order: number;
};

export type OnboardingPayload = {
  displayName: string;
  username: string;
  bio: string;
  /** Preset path/URL, or temporary blob URL when uploading */
  avatarUrl: string;
  avatarFile: File | null;
  ageRange: string;
  countryCode: string;
  timezone: string;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weightUnit: WeightUnit;
  goals: OnboardingGoalInput[];
  skipped: boolean;
};
