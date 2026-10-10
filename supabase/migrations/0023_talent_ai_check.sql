-- ============================================================================
-- Talent Corner — posts and comments only through the AI check
--
-- New posts and comments are now saved by /api/talent (service role) after
-- Claude has checked them against the guidelines. Browsers may no longer
-- insert into these tables directly, so the check cannot be skipped.
-- Likes, follows and deletes are unchanged.
-- ============================================================================

drop policy if exists "talent posts: student insert" on public.talent_posts;
drop policy if exists "talent comments: own insert" on public.talent_comments;
revoke insert on public.talent_posts, public.talent_comments from anon, authenticated;
