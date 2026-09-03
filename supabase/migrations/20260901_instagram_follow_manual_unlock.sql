-- Admin manual unlock before follower HTML verification.
-- Row stays pending; manually_unlocked grants temporary access until HTML match confirms.
ALTER TABLE instagram_follow_bonus
  ADD COLUMN IF NOT EXISTS manually_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manual_unlock_verified_mismatch boolean NOT NULL DEFAULT false;
