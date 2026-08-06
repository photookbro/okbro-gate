-- Allow one user to claim multiple different Instagram handles.
-- Same handle still cannot be approved twice (handle unique index stays).
DROP INDEX IF EXISTS instagram_follow_bonus_user_approved_idx;
