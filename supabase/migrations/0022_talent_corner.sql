-- ============================================================================
-- Talent Corner — students share poems, shayari and content creation
--
-- Anyone (signed in or not) can read posts, likes, comments and followers.
-- Only a signed-in, active, unrestricted STUDENT may post, and only after
-- ticking the community guidelines (guidelines_accepted_at is required).
-- Any signed-in account may like, comment and follow.
-- The administrator may delete any post or comment; blocking or deleting an
-- account (profiles.restricted / status) hides that student's posts at once.
-- Counts are kept on the post by triggers so the public list needs one query.
-- ============================================================================

-- True when the account may act in the Talent Corner (active, not blocked).
create or replace function public.talent_member_ok(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_uid and p.status = 'active' and p.restricted = false
  )
$$;

create or replace function public.talent_can_post()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.status = 'active' and p.restricted = false
  )
$$;

grant execute on function public.talent_member_ok(uuid) to anon, authenticated;
grant execute on function public.talent_can_post() to authenticated;

-- ------------------------------------------------------------------ posts

create table if not exists public.talent_posts (
  id                      uuid primary key default gen_random_uuid(),
  author_id               uuid not null references public.profiles (id) on delete cascade,
  author_name             text not null check (char_length(author_name) between 1 and 60),
  author_gender           text not null default '',
  category                text not null check (category in ('poem', 'shayari', 'content')),
  title                   text not null default '' check (char_length(title) <= 120),
  body                    text not null default '' check (char_length(body) <= 4000),
  language                text not null default '' check (char_length(language) <= 20),
  -- "Written by": the poet's name when it is not the student's own words.
  credit                  text not null default '' check (char_length(credit) <= 60),
  link_url                text not null default '' check (link_url = '' or link_url ~* '^https://[^ ]{4,500}$'),
  images                  jsonb not null default '[]'::jsonb,
  guidelines_accepted_at  timestamptz not null,
  likes_count             integer not null default 0,
  comments_count          integer not null default 0,
  created_at              timestamptz not null default now(),
  -- Words need text; content creation needs a link or a picture.
  constraint talent_posts_has_content check (
    (category in ('poem', 'shayari') and char_length(btrim(body)) >= 2)
    or (category = 'content' and (link_url <> '' or jsonb_array_length(images) > 0))
  )
);

create index if not exists talent_posts_created_idx on public.talent_posts (created_at desc);
create index if not exists talent_posts_author_idx on public.talent_posts (author_id);
create index if not exists talent_posts_category_idx on public.talent_posts (category, created_at desc);

alter table public.talent_posts enable row level security;

drop policy if exists "talent posts: read" on public.talent_posts;
create policy "talent posts: read" on public.talent_posts for select to anon, authenticated
  using (public.talent_member_ok(author_id));
drop policy if exists "talent posts: student insert" on public.talent_posts;
create policy "talent posts: student insert" on public.talent_posts for insert to authenticated
  with check (author_id = auth.uid() and public.talent_can_post());
drop policy if exists "talent posts: owner or admin delete" on public.talent_posts;
create policy "talent posts: owner or admin delete" on public.talent_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

grant select on public.talent_posts to anon, authenticated;
grant insert, delete on public.talent_posts to authenticated;

-- Counts start at zero and only the triggers move them; at most 10 posts a day.
create or replace function public.guard_talent_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.likes_count := 0;
  new.comments_count := 0;
  new.created_at := now();
  if (select count(*) from public.talent_posts
      where author_id = new.author_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You can share up to 10 posts a day. Please try again tomorrow.';
  end if;
  return new;
end $$;
drop trigger if exists guard_talent_post on public.talent_posts;
create trigger guard_talent_post before insert on public.talent_posts
  for each row execute function public.guard_talent_post();

-- ------------------------------------------------------------------ likes

create table if not exists public.talent_likes (
  post_id     uuid not null references public.talent_posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists talent_likes_user_idx on public.talent_likes (user_id);

alter table public.talent_likes enable row level security;
drop policy if exists "talent likes: read" on public.talent_likes;
create policy "talent likes: read" on public.talent_likes for select to anon, authenticated using (true);
drop policy if exists "talent likes: own insert" on public.talent_likes;
create policy "talent likes: own insert" on public.talent_likes for insert to authenticated
  with check (user_id = auth.uid() and public.talent_member_ok(auth.uid()));
drop policy if exists "talent likes: own delete" on public.talent_likes;
create policy "talent likes: own delete" on public.talent_likes for delete to authenticated
  using (user_id = auth.uid());
grant select on public.talent_likes to anon, authenticated;
grant insert, delete on public.talent_likes to authenticated;

-- ------------------------------------------------------------------ comments

create table if not exists public.talent_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.talent_posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  user_name   text not null check (char_length(user_name) between 1 and 60),
  body        text not null check (char_length(btrim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists talent_comments_post_idx on public.talent_comments (post_id, created_at);

alter table public.talent_comments enable row level security;
drop policy if exists "talent comments: read" on public.talent_comments;
create policy "talent comments: read" on public.talent_comments for select to anon, authenticated
  using (public.talent_member_ok(user_id));
drop policy if exists "talent comments: own insert" on public.talent_comments;
create policy "talent comments: own insert" on public.talent_comments for insert to authenticated
  with check (user_id = auth.uid() and public.talent_member_ok(auth.uid()));
-- The writer, the post's author, or the administrator may remove a comment.
drop policy if exists "talent comments: delete" on public.talent_comments;
create policy "talent comments: delete" on public.talent_comments for delete to authenticated
  using (
    user_id = auth.uid() or public.is_admin()
    or exists (select 1 from public.talent_posts p where p.id = post_id and p.author_id = auth.uid())
  );
grant select on public.talent_comments to anon, authenticated;
grant insert, delete on public.talent_comments to authenticated;

create or replace function public.guard_talent_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  if (select count(*) from public.talent_comments
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many comments in a short time. Please wait a while.';
  end if;
  return new;
end $$;
drop trigger if exists guard_talent_comment on public.talent_comments;
create trigger guard_talent_comment before insert on public.talent_comments
  for each row execute function public.guard_talent_comment();

-- ------------------------------------------------------------------ follows

create table if not exists public.talent_follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  followee_id  uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint talent_follows_not_self check (follower_id <> followee_id)
);
create index if not exists talent_follows_followee_idx on public.talent_follows (followee_id);

alter table public.talent_follows enable row level security;
drop policy if exists "talent follows: read" on public.talent_follows;
create policy "talent follows: read" on public.talent_follows for select to anon, authenticated using (true);
drop policy if exists "talent follows: own insert" on public.talent_follows;
create policy "talent follows: own insert" on public.talent_follows for insert to authenticated
  with check (follower_id = auth.uid() and public.talent_member_ok(auth.uid()));
drop policy if exists "talent follows: own delete" on public.talent_follows;
create policy "talent follows: own delete" on public.talent_follows for delete to authenticated
  using (follower_id = auth.uid());
grant select on public.talent_follows to anon, authenticated;
grant insert, delete on public.talent_follows to authenticated;

-- ------------------------------------------------------------------ counters

create or replace function public.talent_count_likes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.talent_posts set likes_count = likes_count + 1 where id = new.post_id;
  else
    update public.talent_posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists talent_count_likes on public.talent_likes;
create trigger talent_count_likes after insert or delete on public.talent_likes
  for each row execute function public.talent_count_likes();

create or replace function public.talent_count_comments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.talent_posts set comments_count = comments_count + 1 where id = new.post_id;
  else
    update public.talent_posts set comments_count = greatest(comments_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists talent_count_comments on public.talent_comments;
create trigger talent_count_comments after insert or delete on public.talent_comments
  for each row execute function public.talent_count_comments();

revoke execute on function public.guard_talent_post() from public, anon, authenticated;
revoke execute on function public.guard_talent_comment() from public, anon, authenticated;
revoke execute on function public.talent_count_likes() from public, anon, authenticated;
revoke execute on function public.talent_count_comments() from public, anon, authenticated;

revoke insert, update, delete, truncate on public.talent_posts, public.talent_likes, public.talent_comments, public.talent_follows from anon;
revoke update, truncate on public.talent_posts, public.talent_likes, public.talent_comments, public.talent_follows from authenticated;
