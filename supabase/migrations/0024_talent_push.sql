-- ============================================================================
-- Talent Corner — phone notification for every new post
--
-- push_sent_at is claimed once by /api/site-push ({ notify: "talent" }) so a
-- post is announced only one time. Browsers cannot write it (no update grant
-- on talent_posts for anon/authenticated).
-- ============================================================================

alter table public.talent_posts add column if not exists push_sent_at timestamptz;
