"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { uploadAvatar, validateAvatarFile } from "@/lib/avatar";
import { hoursGoalTarget, slugifyUsername } from "@/lib/goals";
import {
  formatGoalDetail,
  resolveGoalProgress
} from "@/lib/profile-format";
import { updateProfileAndGoals } from "@/lib/profile-update";
import { LIVE_IMAGES } from "@/lib/live-images";
import { createClient } from "@/lib/supabase/client";
import type { Goal, Profile, ProfileViewModel } from "@/lib/types/profile";
import "@/app/landing.css";
import "@/app/profile-edit.css";

const DEFAULT_AVATARS = [
  LIVE_IMAGES.participant1,
  LIVE_IMAGES.participant2,
  LIVE_IMAGES.participant3,
  LIVE_IMAGES.participant4,
  LIVE_IMAGES.participant5,
  LIVE_IMAGES.participant6
];

type GoalDraft = {
  id: string;
  template_id: string;
  title: string;
  current_value: string;
  target_value: string;
  unit: string | null;
};

function toGoalDrafts(goals: Goal[]): GoalDraft[] {
  return goals.map((goal) => ({
    id: goal.id,
    template_id: goal.template_id,
    title: goal.title,
    current_value:
      goal.current_value == null ? "" : String(goal.current_value),
    target_value: goal.target_value == null ? "" : String(goal.target_value),
    unit: goal.unit
  }));
}

function unitLabel(unit: string | null) {
  if (unit === "kg") return "kg";
  if (unit === "kcal") return "kcal";
  if (unit === "hours") return "hrs";
  if (unit === "days") return "days";
  return unit ?? "";
}

export function ProfileEditDrawer({
  open,
  profile,
  goals,
  onClose,
  onSaved
}: {
  open: boolean;
  profile: Profile;
  goals: Goal[];
  onClose: () => void;
  onSaved: (data: ProfileViewModel) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [username, setUsername] = useState(profile.username ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(
    profile.avatar_url || DEFAULT_AVATARS[3]
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [goalDrafts, setGoalDrafts] = useState(() => toGoalDrafts(goals));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.display_name ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar_url || DEFAULT_AVATARS[3]);
    setPreviewUrl(null);
    setAvatarFile(null);
    setGoalDrafts(toGoalDrafts(goals));
    setError(null);
  }, [open, profile, goals]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, saving]);

  const activeAvatar = previewUrl ?? avatarUrl;

  const updateGoalField = (
    id: string,
    field: "title" | "current_value" | "target_value",
    value: string
  ) => {
    setGoalDrafts((prev) =>
      prev.map((goal) => (goal.id === id ? { ...goal, [field]: value } : goal))
    );
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setAvatarFile(file);
    setError(null);
    setAvatarUploading(true);

    try {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sign in again to upload a photo.");

      const publicUrl = await uploadAvatar(supabase, user.id, file);
      if (localPreview.startsWith("blob:")) URL.revokeObjectURL(localPreview);
      setPreviewUrl(null);
      setAvatarUrl(publicUrl);
      setAvatarFile(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not upload your photo. Try again."
      );
      setAvatarFile(file);
    } finally {
      setAvatarUploading(false);
    }
  };

  const save = async () => {
    if (saving || avatarUploading) return;
    setSaving(true);
    setError(null);

    try {
      const handle = slugifyUsername(username);
      if (!displayName.trim()) throw new Error("Display name is required.");
      if (!handle || handle.length < 3) {
        throw new Error("Username needs at least 3 characters.");
      }

      const parsedGoals = goalDrafts.map((goal) => {
        const current = Number.parseFloat(goal.current_value);
        const target = Number.parseFloat(goal.target_value);
        if (!Number.isFinite(current) || !Number.isFinite(target)) {
          throw new Error(`Enter valid numbers for “${goal.title}”.`);
        }
        return {
          id: goal.id,
          template_id: goal.template_id,
          title: goal.title,
          current_value: current,
          target_value:
            goal.template_id === "hours_worked"
              ? hoursGoalTarget(current)
              : target,
          unit: goal.unit
        };
      });

      const result = await updateProfileAndGoals(supabase, {
        displayName: displayName.trim(),
        username: handle,
        bio,
        avatarUrl:
          previewUrl && !previewUrl.startsWith("blob:")
            ? previewUrl
            : avatarUrl,
        avatarFile,
        goals: parsedGoals
      });

      const hoursGoalRow = result.goals.find((g) => g.template_id === "hours_worked");
      const streakGoal = result.goals.find((g) => g.template_id === "mobility_streak");
      const hoursWorked = Number(hoursGoalRow?.current_value ?? 0);
      const hoursGoal = Number(
        hoursGoalRow?.target_value ?? hoursGoalTarget(hoursWorked)
      );

      onSaved({
        profile: result.profile,
        goals: result.goals,
        hoursWorked,
        hoursGoal,
        hoursProgress: resolveGoalProgress(
          hoursGoalRow ?? {
            id: "hours",
            user_id: result.profile.id,
            template_id: "hours_worked",
            title: "Hours worked",
            detail: null,
            category: "consistency",
            current_value: hoursWorked,
            target_value: hoursGoal,
            unit: "hours",
            progress: 0,
            sort_order: 0,
            created_at: "",
            updated_at: ""
          }
        ),
        dayStreak: Math.round(Number(streakGoal?.current_value ?? 0))
      });
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not save changes. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="profile-edit-backdrop"
      onClick={() => {
        if (!saving) onClose();
      }}
      role="presentation"
    >
      <div
        className="profile-edit-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-edit-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="profile-edit-header">
          <div>
            <p className="profile-edit-kicker">Edit profile</p>
            <h2 id="profile-edit-title">Update your presence</h2>
          </div>
          <button
            type="button"
            className="profile-edit-close"
            aria-label="Close editor"
            disabled={saving}
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="profile-edit-body">
          <section className="profile-edit-section">
            <h3>Photo</h3>
            <div className="profile-edit-avatar-row">
              <div className="profile-edit-avatar-preview">
                <Image
                  alt=""
                  className="profile-edit-avatar-image"
                  fill
                  sizes="88px"
                  src={activeAvatar}
                  unoptimized={
                    activeAvatar.startsWith("blob:") ||
                    activeAvatar.includes("supabase.co")
                  }
                />
                {avatarUploading ? (
                  <span className="profile-edit-avatar-busy">Uploading…</span>
                ) : null}
              </div>
              <div className="profile-edit-avatar-actions">
                <div className="profile-edit-avatar-options">
                  {DEFAULT_AVATARS.map((src) => (
                    <button
                      key={src}
                      type="button"
                      className={`profile-edit-avatar-choice${
                        !previewUrl && avatarUrl === src ? " is-selected" : ""
                      }`}
                      disabled={saving || avatarUploading}
                      aria-label="Choose default avatar"
                      onClick={() => {
                        if (previewUrl?.startsWith("blob:")) {
                          URL.revokeObjectURL(previewUrl);
                        }
                        setPreviewUrl(null);
                        setAvatarFile(null);
                        setAvatarUrl(src);
                      }}
                    >
                      <Image
                        alt=""
                        className="profile-edit-avatar-choice-image"
                        fill
                        sizes="40px"
                        src={src}
                      />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={saving || avatarUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarUploading ? "Uploading…" : "Upload photo"}
                </button>
                <input
                  ref={fileInputRef}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  type="file"
                  onChange={(event) => {
                    void onPickFile(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
          </section>

          <section className="profile-edit-section">
            <h3>Profile</h3>
            <label className="profile-edit-field">
              <span>Display name</span>
              <input
                value={displayName}
                maxLength={40}
                disabled={saving}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
            <label className="profile-edit-field">
              <span>Username</span>
              <div className="profile-edit-username">
                <span aria-hidden>@</span>
                <input
                  value={username}
                  maxLength={20}
                  disabled={saving}
                  onChange={(event) =>
                    setUsername(slugifyUsername(event.target.value))
                  }
                />
              </div>
            </label>
            <label className="profile-edit-field">
              <span>Bio</span>
              <textarea
                value={bio}
                maxLength={160}
                rows={3}
                disabled={saving}
                onChange={(event) => setBio(event.target.value)}
              />
            </label>
          </section>

          <section className="profile-edit-section">
            <h3>Goals</h3>
            <div className="profile-edit-goals">
              {goalDrafts.map((goal) => (
                <article className="profile-edit-goal" key={goal.id}>
                  <label className="profile-edit-field">
                    <span>Title</span>
                    <input
                      value={goal.title}
                      disabled={saving}
                      onChange={(event) =>
                        updateGoalField(goal.id, "title", event.target.value)
                      }
                    />
                  </label>
                  <div className="profile-edit-goal-metrics">
                    <label className="profile-edit-field">
                      <span>Current ({unitLabel(goal.unit)})</span>
                      <input
                        inputMode="decimal"
                        value={goal.current_value}
                        disabled={saving}
                        onChange={(event) =>
                          updateGoalField(
                            goal.id,
                            "current_value",
                            event.target.value
                          )
                        }
                      />
                    </label>
                    <label className="profile-edit-field">
                      <span>
                        Target ({unitLabel(goal.unit)})
                        {goal.template_id === "hours_worked"
                          ? " · auto"
                          : ""}
                      </span>
                      <input
                        inputMode="decimal"
                        value={
                          goal.template_id === "hours_worked"
                            ? String(
                                hoursGoalTarget(
                                  Number.parseFloat(goal.current_value) || 0
                                )
                              )
                            : goal.target_value
                        }
                        disabled={saving || goal.template_id === "hours_worked"}
                        onChange={(event) =>
                          updateGoalField(
                            goal.id,
                            "target_value",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                  <p className="profile-edit-goal-hint">
                    {formatGoalDetail({
                      id: goal.id,
                      user_id: profile.id,
                      template_id: goal.template_id,
                      title: goal.title,
                      detail: null,
                      category: "consistency",
                      current_value: Number.parseFloat(goal.current_value) || 0,
                      target_value:
                        goal.template_id === "hours_worked"
                          ? hoursGoalTarget(
                              Number.parseFloat(goal.current_value) || 0
                            )
                          : Number.parseFloat(goal.target_value) || 0,
                      unit: goal.unit,
                      progress: 0,
                      sort_order: 0,
                      created_at: "",
                      updated_at: ""
                    })}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {error ? (
            <p className="profile-edit-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="profile-edit-footer">
          <button
            type="button"
            className="btn-secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving || avatarUploading}
            onClick={() => {
              void save();
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}
