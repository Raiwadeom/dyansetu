import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Ban, Check, ExternalLink, Feather, Heart, ImagePlus, Link2, Loader2, MessageCircle,
  MoreVertical, PenLine, Play, Plus, Quote, Send, Share2, ShieldCheck, Sparkles, Trash2, UserCheck,
  UserMinus, UserPlus, Users, Video, X,
} from "lucide-react";

import {
  TALENT_CATEGORIES, TALENT_GUIDELINES, TALENT_LANGUAGES, MAX_TALENT_IMAGES, TALENT_BODY_MAX,
  fetchTalentPosts, createTalentPost, deleteTalentPost, fetchMyLikes, setLike, fetchComments, addComment,
  deleteComment, fetchFollowing, setFollow, fetchFollowerCount, youTubeId, linkHost, timeAgo, looksUnsafe,
} from "../lib/talent.js";
import { isBackendConfigured } from "../lib/supabase.js";
import { AvatarCycle } from "../lib/ProfileArt.jsx";
import "./talent.css";

/* ============================================================================
   DnyanSetu — Talent Corner

   Open to everyone for reading. Signed-in students share poems, shayari or
   content creation (a YouTube / Instagram link and/or photos) after ticking
   the community guidelines. Any signed-in account likes, comments and
   follows. The administrator removes posts and comments and can block or
   delete the account behind them, right from the card.
   ========================================================================== */

const CAT_ICON = { poem: Feather, shayari: Quote, content: Video };
const catMeta = (id) => TALENT_CATEGORIES.find((c) => c.id === id) || TALENT_CATEGORIES[0];
const LONG_LINES = 12;

export default function TalentPage({ user, onBack, onSignIn, onBlockUser, onDeleteUser, readIntent, clearIntent }) {
  /* What to open on: a tab, a shared post (/talent?post=<id>) or the composer. */
  const [intent] = useState(() => readIntent?.() || {});
  useEffect(() => { clearIntent?.(); }, [clearIntent]);
  const isAdmin = user?.role === "admin";
  const canPost = user?.role === "student";
  const [tab, setTab] = useState(() => intent.tab || "all");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liked, setLiked] = useState(new Set());
  const [following, setFollowing] = useState(new Set());
  const [author, setAuthor] = useState(null); // { id, name, gender }
  const [composeOpen, setComposeOpen] = useState(() => Boolean(intent.compose) && user?.role === "student");
  const [guideOpen, setGuideOpen] = useState(false);
  const [focusId, setFocusId] = useState(() => intent.post || "");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(0);

  const say = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  /* Load the list for the current tab / author. */
  const followKey = tab === "following" ? [...following].sort().join() : "";
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const opts = author
      ? { authorId: author.id }
      : tab === "following"
        ? { authorIds: [...following] }
        : { category: tab === "all" ? "" : tab };
    fetchTalentPosts(opts)
      .then((list) => { if (alive) setPosts(list); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, author, followKey]);

  useEffect(() => {
    if (!user) { setFollowing(new Set()); return; }
    fetchFollowing(user.id).then(setFollowing).catch(() => {});
  }, [user?.id]);

  const postIds = posts.map((p) => p.id).join();
  useEffect(() => {
    if (!user || !posts.length) return;
    fetchMyLikes(user.id, posts.map((p) => p.id)).then(setLiked).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, postIds]);

  /* A shared link: scroll to that post once it is on screen. */
  useEffect(() => {
    if (!focusId || loading) return;
    const el = document.getElementById(`tc-post-${focusId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-focus");
      setTimeout(() => el.classList.remove("is-focus"), 2400);
    }
    setFocusId("");
  }, [focusId, loading]);

  const needSignIn = (what) => {
    say(`Log in to ${what}.`);
    setTimeout(() => onSignIn?.(), 700);
  };

  const toggleLike = async (post) => {
    if (!user) return needSignIn("like posts");
    const on = !liked.has(post.id);
    setLiked((prev) => { const n = new Set(prev); on ? n.add(post.id) : n.delete(post.id); return n; });
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: Math.max(0, p.likes + (on ? 1 : -1)) } : p)));
    try { await setLike(post.id, user.id, on); } catch (e) {
      say(e.message);
      setLiked((prev) => { const n = new Set(prev); on ? n.delete(post.id) : n.add(post.id); return n; });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: Math.max(0, p.likes + (on ? -1 : 1)) } : p)));
    }
  };

  const toggleFollow = async (authorId) => {
    if (!user) return needSignIn("follow creators");
    const on = !following.has(authorId);
    setFollowing((prev) => { const n = new Set(prev); on ? n.add(authorId) : n.delete(authorId); return n; });
    try {
      await setFollow(user.id, authorId, on);
      say(on ? "Following — their posts show under Following." : "Unfollowed.");
    } catch (e) {
      say(e.message);
      setFollowing((prev) => { const n = new Set(prev); on ? n.delete(authorId) : n.add(authorId); return n; });
    }
  };

  const removePost = async (post) => {
    if (!window.confirm(isAdmin && post.authorId !== user?.id ? `Remove this post by ${post.author}?` : "Delete your post?")) return;
    try {
      await deleteTalentPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      say("Post removed.");
    } catch (e) { say(e.message); }
  };

  const blockAuthor = async (post) => {
    if (!window.confirm(`Block ${post.author}? They will be signed out, cannot use DnyanSetu and all their posts are hidden. You can unblock them later from the Admin Control Desk.`)) return;
    try {
      await onBlockUser?.(post.authorId);
      setPosts((prev) => prev.filter((p) => p.authorId !== post.authorId));
      say(`${post.author} is blocked.`);
    } catch (e) { say(e.message || "Could not block that account."); }
  };

  const deleteAuthor = async (post) => {
    if (!window.confirm(`Delete ${post.author}'s account? This removes the account and hides every post. It cannot be undone here.`)) return;
    try {
      await onDeleteUser?.(post.authorId);
      setPosts((prev) => prev.filter((p) => p.authorId !== post.authorId));
      say("Account deleted.");
    } catch (e) { say(e.message || "Could not delete that account."); }
  };

  const sharePost = async (post) => {
    const url = `${window.location.origin}/talent?post=${post.id}`;
    const title = post.title || `${catMeta(post.category).one} by ${post.author}`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url);
      say("Link copied.");
    } catch { /* closed the share sheet */ }
  };

  const openAuthor = (post) => {
    setAuthor({ id: post.authorId, name: post.author, gender: post.authorGender });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPosted = (post) => {
    setComposeOpen(false);
    setAuthor(null);
    setTab("all");
    setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
    say("Shared! Your talent is live.");
  };

  const tabs = [
    { id: "all", label: "All", icon: Sparkles },
    ...TALENT_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: CAT_ICON[c.id] })),
    ...(user ? [{ id: "following", label: "Following", icon: Users }] : []),
  ];

  return (
    <div className="tc-page">
      <header className="tc-hero">
        <div className="tc-hero-glow" aria-hidden="true" />
        <div className="tc-hero-inner">
          <div className="tc-hero-top">
            <button type="button" className="tc-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>
          </div>

          <div className="tc-hero-grid">
            <div className="tc-hero-copy">
              <span className="tc-eyebrow"><Sparkles size={14} /> Student Talent Corner <i>·</i> <b lang="mr">कला मंच</b></span>
              <h1 className="tc-title">Where words, voices and <span>ideas</span> shine.</h1>
              <p className="tc-sub">
                Poems, shayari and creative content by the students of our college. Free for everyone to read —
                like, comment and follow your favourite creators.
              </p>
              <div className="tc-hero-actions">
                {canPost && (
                  <button type="button" className="tc-btn tc-btn-primary" onClick={() => setComposeOpen(true)}>
                    <Plus size={17} /> Share your talent
                  </button>
                )}
                {!user && (
                  <button type="button" className="tc-btn tc-btn-primary" onClick={onSignIn}>
                    <PenLine size={17} /> Log in to share
                  </button>
                )}
                <button type="button" className="tc-btn tc-btn-ghost" onClick={() => setGuideOpen(true)}>
                  <ShieldCheck size={17} /> Community guidelines
                </button>
              </div>
              <ul className="tc-hero-points">
                <li><Heart size={14} /> Like</li>
                <li><MessageCircle size={14} /> Comment</li>
                <li><UserPlus size={14} /> Follow</li>
                <li><ShieldCheck size={14} /> Moderated</li>
              </ul>
            </div>

            <div className="tc-hero-art" aria-hidden="true">
              <div className="tc-float tc-float--poem">
                <span className="tc-chip tc-chip--poem"><Feather size={12} /> Poem</span>
                <p>पहिला पाऊस, मातीचा गंध,<br />आठवणींचा ओला छंद…</p>
                <small><Heart size={12} fill="currentColor" /> 128</small>
              </div>
              <div className="tc-float tc-float--shayari">
                <span className="tc-chip tc-chip--shayari"><Quote size={12} /> Shayari</span>
                <p>Kuch khwab adhoore hi sahi,<br />par hausle poore hain.</p>
                <small><Heart size={12} fill="currentColor" /> 96</small>
              </div>
              <div className="tc-float tc-float--content">
                <span className="tc-float-video"><Play size={20} fill="currentColor" /></span>
                <div>
                  <span className="tc-chip tc-chip--content"><Video size={12} /> Content</span>
                  <strong>Campus vlog · Day 1</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="tc-shell">
        {author ? (
          <AuthorBar
            author={author}
            isMe={user?.id === author.id}
            following={following.has(author.id)}
            onFollow={() => toggleFollow(author.id)}
            onClose={() => setAuthor(null)}
            postCount={loading ? null : posts.length}
          />
        ) : (
          <nav className="tc-tabs" aria-label="Talent categories">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  type="button"
                  key={t.id}
                  className={`tc-tab tc-tab--${t.id} ${tab === t.id ? "is-active" : ""}`}
                  aria-pressed={tab === t.id}
                  onClick={() => setTab(t.id)}
                >
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </nav>
        )}

        {!isBackendConfigured && <p className="tc-empty">The Talent Corner needs the live backend.</p>}
        {error && <p className="tc-error">{error}</p>}

        {loading ? (
          <div className="tc-grid">
            {[0, 1, 2].map((i) => (
              <div className="tc-skel" key={i} aria-hidden="true">
                <span className="tc-skel-chip" />
                <span className="tc-skel-block" style={{ height: 90 + (i % 3) * 36 }} />
                <span className="tc-skel-line" />
                <span className="tc-skel-line is-short" />
                <span className="tc-skel-by"><i /><b /></span>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="tc-empty-box">
            <Sparkles size={28} />
            <h3>{tab === "following" && !author ? "Follow creators to fill this feed" : "No posts here yet"}</h3>
            <p>
              {tab === "following" && !author
                ? "Tap Follow on any post and their new work shows up here."
                : canPost ? "Be the first — share a poem, a shayari or your latest reel." : "Check back soon for new work from our students."}
            </p>
            {canPost && !author && tab !== "following" && (
              <button type="button" className="tc-btn tc-btn-primary" onClick={() => setComposeOpen(true)}><Plus size={16} /> Share your talent</button>
            )}
          </div>
        ) : (
          <div className="tc-grid">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                user={user}
                isAdmin={isAdmin}
                liked={liked.has(post.id)}
                following={following.has(post.authorId)}
                onLike={() => toggleLike(post)}
                onFollow={() => toggleFollow(post.authorId)}
                onAuthor={() => openAuthor(post)}
                onShare={() => sharePost(post)}
                onDelete={() => removePost(post)}
                onBlock={() => blockAuthor(post)}
                onDeleteAccount={() => deleteAuthor(post)}
                onCommentsChange={(n) => setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, comments: n } : p)))}
                needSignIn={needSignIn}
                say={say}
              />
            ))}
          </div>
        )}
      </div>

      {canPost && !composeOpen && (
        <button type="button" className="tc-fab" onClick={() => setComposeOpen(true)} aria-label="Share your talent">
          <Plus size={24} />
        </button>
      )}

      {composeOpen && <ComposeModal user={user} onClose={() => setComposeOpen(false)} onPosted={onPosted} />}
      {guideOpen && <GuidelinesModal onClose={() => setGuideOpen(false)} />}
      {toast && <div className="tc-toast" role="status">{toast}</div>}
    </div>
  );
}

/* --------------------------------------------------------------- author bar */

function AuthorBar({ author, isMe, following, onFollow, onClose, postCount }) {
  const [followers, setFollowers] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchFollowerCount(author.id).then((n) => { if (alive) setFollowers(n); }).catch(() => {});
    return () => { alive = false; };
  }, [author.id, following]);
  return (
    <div className="tc-author-bar">
      <AvatarCycle gender={author.gender} seed={author.id} className="tc-author-avatar" />
      <div className="tc-author-copy">
        <h2>{author.name}</h2>
        <p>
          {postCount ?? "…"} post{postCount === 1 ? "" : "s"} · {followers ?? "…"} follower{followers === 1 ? "" : "s"}
        </p>
      </div>
      <div className="tc-author-actions">
        {!isMe && (
          <button type="button" className={`tc-follow ${following ? "is-on" : ""}`} onClick={onFollow}>
            {following ? <><UserCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
          </button>
        )}
        <button type="button" className="tc-icon-btn" onClick={onClose} aria-label="Back to all posts"><X size={18} /></button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- post card */

function PostCard({ post, user, isAdmin, liked, following, onLike, onFollow, onAuthor, onShare, onDelete, onBlock, onDeleteAccount, onCommentsChange, needSignIn, say }) {
  const meta = catMeta(post.category);
  const Icon = CAT_ICON[post.category] || Sparkles;
  const isWords = post.category !== "content";
  const isMine = user?.id === post.authorId;
  const lines = post.body.split("\n");
  const isLong = lines.length > LONG_LINES || post.body.length > 700;
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [menu, setMenu] = useState(false);
  const [pop, setPop] = useState(false);
  const yt = youTubeId(post.link);
  const [playing, setPlaying] = useState(false);

  const like = () => {
    if (!liked) { setPop(true); setTimeout(() => setPop(false), 450); }
    onLike();
  };

  return (
    <article className={`tc-card tc-card--${post.category}`} id={`tc-post-${post.id}`}>
      <div className="tc-card-top">
        <span className={`tc-chip tc-chip--${post.category}`}><Icon size={13} /> {meta.one}</span>
        {post.language && <span className="tc-lang">{post.language}</span>}
        {(isMine || isAdmin) && (
          <div className="tc-menu-wrap">
            <button type="button" className="tc-icon-btn" aria-label="Post options" onClick={() => setMenu((m) => !m)}>
              <MoreVertical size={17} />
            </button>
            {menu && (
              <div className="tc-menu" onMouseLeave={() => setMenu(false)}>
                <button type="button" onClick={() => { setMenu(false); onDelete(); }}><Trash2 size={14} /> {isMine ? "Delete my post" : "Remove post"}</button>
                {isAdmin && !isMine && (
                  <>
                    <button type="button" onClick={() => { setMenu(false); onBlock(); }}><Ban size={14} /> Block account</button>
                    <button type="button" className="is-danger" onClick={() => { setMenu(false); onDeleteAccount(); }}><UserMinus size={14} /> Delete account</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {post.title && <h3 className="tc-card-title">{post.title}</h3>}

      {isWords ? (
        <div className={`tc-verse ${isLong && !expanded ? "is-clamped" : ""}`}>
          <Quote className="tc-verse-mark" size={30} aria-hidden="true" />
          <p>{post.body}</p>
        </div>
      ) : (
        <>
          {yt && (
            <div className="tc-video">
              {playing ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`}
                  title={post.title || "Video"}
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button type="button" className="tc-video-thumb" onClick={() => setPlaying(true)} aria-label="Play video">
                  <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" loading="lazy" />
                  <span className="tc-play"><Play size={26} fill="currentColor" /></span>
                </button>
              )}
            </div>
          )}
          {post.images.length > 0 && (
            <div className={`tc-gallery tc-gallery--${Math.min(post.images.length, 3)}`}>
              {post.images.map((img) => (
                <a href={img.url} target="_blank" rel="noopener noreferrer" key={img.url}>
                  <img src={img.url} alt={post.title || "Student work"} loading="lazy" />
                </a>
              ))}
            </div>
          )}
          {post.body && <p className={`tc-caption ${isLong && !expanded ? "is-clamped" : ""}`}>{post.body}</p>}
          {post.link && !yt && (
            <a className="tc-link-card" href={post.link} target="_blank" rel="noopener noreferrer nofollow ugc">
              <Link2 size={16} /> <span>Watch on {linkHost(post.link)}</span> <ExternalLink size={14} />
            </a>
          )}
          {post.link && yt && (
            <a className="tc-link-mini" href={post.link} target="_blank" rel="noopener noreferrer nofollow ugc">Open on YouTube <ExternalLink size={12} /></a>
          )}
        </>
      )}
      {isLong && (
        <button type="button" className="tc-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show less" : "Read full"}
        </button>
      )}
      {post.credit && post.credit !== post.author && <p className="tc-credit">— {post.credit}</p>}

      <div className="tc-byline">
        <button type="button" className="tc-byline-who" onClick={onAuthor}>
          <AvatarCycle gender={post.authorGender} seed={post.authorId} className="tc-avatar" />
          <span>
            <strong>{post.author}</strong>
            <small>{timeAgo(post.createdAt)}</small>
          </span>
        </button>
        {!isMine && (
          <button type="button" className={`tc-follow tc-follow--sm ${following ? "is-on" : ""}`} onClick={onFollow}>
            {following ? <><Check size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
          </button>
        )}
      </div>

      <div className="tc-actions">
        <button type="button" className={`tc-act tc-like ${liked ? "is-on" : ""} ${pop ? "is-pop" : ""}`} onClick={like} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"}>
          <Heart size={18} fill={liked ? "currentColor" : "none"} /> <span>{post.likes}</span>
        </button>
        <button type="button" className={`tc-act ${showComments ? "is-open" : ""}`} onClick={() => setShowComments((v) => !v)} aria-expanded={showComments}>
          <MessageCircle size={18} /> <span>{post.comments}</span>
        </button>
        <button type="button" className="tc-act tc-act-share" onClick={onShare} aria-label="Share">
          <Share2 size={17} />
        </button>
      </div>

      {showComments && (
        <Comments post={post} user={user} isAdmin={isAdmin} onCount={onCommentsChange} needSignIn={needSignIn} say={say} />
      )}
    </article>
  );
}

/* --------------------------------------------------------------- comments */

function Comments({ post, user, isAdmin, onCount, needSignIn, say }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchComments(post.id).then((l) => { if (alive) setList(l); }).catch((e) => { if (alive) { setList([]); say(e.message); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);

  const send = async (e) => {
    e.preventDefault();
    if (!user) return needSignIn("comment");
    const body = text.trim();
    if (!body) return;
    if (looksUnsafe(body)) { say("Please keep comments respectful — no abusive or adult words."); return; }
    setBusy(true);
    try {
      const c = await addComment(post.id, user, body);
      const next = [...(list || []), c];
      setList(next);
      onCount(next.length);
      setText("");
    } catch (err) { say(err.message); } finally { setBusy(false); }
  };

  const remove = async (c) => {
    try {
      await deleteComment(c.id);
      const next = list.filter((x) => x.id !== c.id);
      setList(next);
      onCount(next.length);
    } catch (err) { say(err.message); }
  };

  return (
    <div className="tc-comments">
      {list === null ? (
        <p className="tc-comments-note"><Loader2 size={14} className="tc-spin" /> Loading comments…</p>
      ) : list.length === 0 ? (
        <p className="tc-comments-note">No comments yet. Say something nice!</p>
      ) : (
        <ul>
          {list.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong> <small>{timeAgo(c.createdAt)}</small>
                <p>{c.body}</p>
              </div>
              {(c.userId === user?.id || isAdmin || post.authorId === user?.id) && (
                <button type="button" className="tc-icon-btn" onClick={() => remove(c)} aria-label="Delete comment"><Trash2 size={14} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="tc-comment-form" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder={user ? "Write a comment…" : "Log in to comment"}
          onFocus={() => { if (!user) needSignIn("comment"); }}
          aria-label="Write a comment"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}

/* --------------------------------------------------------------- compose */

function ComposeModal({ user, onClose, onPosted }) {
  const [category, setCategory] = useState("poem");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [credit, setCredit] = useState(user?.name || "");
  const [language, setLanguage] = useState("Marathi");
  const [link, setLink] = useState("");
  const [files, setFiles] = useState([]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState(false);
  const isWords = category !== "content";

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [busy, onClose]);

  const pickFiles = (e) => {
    const chosen = [...e.target.files].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (chosen.length < e.target.files.length) setErr("Only JPG, PNG or WEBP photos can be added.");
    setFiles((prev) => [...prev, ...chosen].slice(0, MAX_TALENT_IMAGES));
    e.target.value = "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBlocked(false);
    const cleanLink = link.trim();
    if (isWords && body.trim().length < 2) return setErr("Paste or write your lines first.");
    if (!isWords && !cleanLink && !files.length) return setErr("Add a link to your video/reel or at least one photo.");
    if (cleanLink && !/^https:\/\/\S{4,}$/i.test(cleanLink)) return setErr("The link must start with https://");
    if (looksUnsafe(title, body, credit, cleanLink)) return setErr("This looks like it breaks the guidelines (adult or abusive words). Please change it.");
    if (!agreed) return setErr("Please tick the guidelines box to continue.");
    setBusy(true);
    try {
      const post = await createTalentPost({
        author: { id: user.id, name: user.name, gender: user.gender },
        category, title, body, language, credit: isWords ? credit : "",
        link: isWords ? "" : cleanLink, files: isWords ? [] : files,
        onProgress: (p) => setProgress(p),
      });
      onPosted(post);
    } catch (e2) {
      setErr(e2.message);
      setBlocked(Boolean(e2.blocked));
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <div className="tc-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form className="tc-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Share your talent">
        <div className="tc-modal-head">
          <div>
            <h2>Share your talent</h2>
            <p>Posting as <strong>{user?.name}</strong></p>
          </div>
          <button type="button" className="tc-icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="tc-modal-body">
          <div className="tc-cat-pick" role="radiogroup" aria-label="What are you sharing?">
            {TALENT_CATEGORIES.map((c) => {
              const Icon = CAT_ICON[c.id];
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={category === c.id}
                  key={c.id}
                  className={`tc-cat tc-cat--${c.id} ${category === c.id ? "is-active" : ""}`}
                  onClick={() => setCategory(c.id)}
                >
                  <Icon size={20} />
                  <span>{c.one}</span>
                </button>
              );
            })}
          </div>

          <label className="tc-field">
            <span>Title <em>(optional)</em></span>
            <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder={isWords ? "e.g. आई / Pehli Baarish" : "e.g. My college vlog — Day 1"} />
          </label>

          {isWords ? (
            <>
              <label className="tc-field">
                <span>Your lines</span>
                <textarea
                  className="tc-verse-input"
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value.slice(0, TALENT_BODY_MAX))}
                  placeholder={category === "shayari" ? "Paste your shayari here — each line on a new line…" : "Paste or write your poem here — line breaks are kept…"}
                />
                <small className="tc-count">{body.length}/{TALENT_BODY_MAX}</small>
              </label>
              <div className="tc-two">
                <label className="tc-field">
                  <span>Written by (author name)</span>
                  <input value={credit} onChange={(e) => setCredit(e.target.value.slice(0, 60))} placeholder="Your name or the poet's name" />
                </label>
                <label className="tc-field">
                  <span>Language</span>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {TALENT_LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <>
              <label className="tc-field">
                <span>Link to your video / reel / page</span>
                <div className="tc-input-icon">
                  <Link2 size={16} />
                  <input value={link} onChange={(e) => setLink(e.target.value.slice(0, 500))} placeholder="https://youtube.com/… or https://instagram.com/reel/…" inputMode="url" />
                </div>
                {youTubeId(link) && <small className="tc-ok"><Check size={13} /> YouTube video — it will play right here.</small>}
              </label>
              <div className="tc-field">
                <span>Photos <em>(optional, up to {MAX_TALENT_IMAGES} — artwork, poster, thumbnail)</em></span>
                <div className="tc-photo-row">
                  {previews.map((src, i) => (
                    <div className="tc-photo" key={src}>
                      <img src={src} alt="" />
                      <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove photo"><X size={13} /></button>
                    </div>
                  ))}
                  {files.length < MAX_TALENT_IMAGES && (
                    <label className="tc-photo-add">
                      <ImagePlus size={22} />
                      <span>Add</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pickFiles} hidden />
                    </label>
                  )}
                </div>
              </div>
              <label className="tc-field">
                <span>Caption <em>(optional)</em></span>
                <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value.slice(0, 1000))} placeholder="Tell people what it is about…" />
              </label>
            </>
          )}

          <div className={`tc-guide-box ${agreed ? "is-ok" : ""}`}>
            <p className="tc-guide-head"><ShieldCheck size={16} /> Community guidelines · checked by AI</p>
            <ul>{TALENT_GUIDELINES.map((g) => <li key={g}>{g}</li>)}</ul>
            <label className="tc-check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I have read the guidelines and my post follows them.</span>
            </label>
          </div>

          {err && (blocked ? (
            <div className="tc-blocked" role="alert">
              <ShieldCheck size={20} />
              <div><strong>Not posted — AI guideline check</strong><p>{err}</p><small>Change your post so it follows the guidelines, then try again.</small></div>
            </div>
          ) : <p className="tc-error">{err}</p>)}
          {busy && progress >= 100 || (busy && !files.length) ? (
            <p className="tc-checking"><Sparkles size={15} /> Our AI is reading your post against the guidelines — this takes a few seconds.</p>
          ) : null}
        </div>

        <div className="tc-modal-foot">
          <button type="button" className="tc-btn tc-btn-ghost-dark" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="tc-btn tc-btn-primary" disabled={busy || !agreed}>
            {busy ? <><Loader2 size={16} className="tc-spin" /> {progress > 0 && progress < 100 ? `Uploading ${progress}%` : "AI is checking…"}</> : <><Send size={16} /> Post</>}
          </button>
        </div>
      </form>
    </div>
  );
}

function GuidelinesModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="tc-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tc-modal tc-modal--sm" role="dialog" aria-modal="true" aria-label="Community guidelines">
        <div className="tc-modal-head">
          <div><h2>Community guidelines</h2><p>Keep the Talent Corner safe and kind for everyone.</p></div>
          <button type="button" className="tc-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="tc-modal-body">
          <ul className="tc-guide-list">{TALENT_GUIDELINES.map((g) => <li key={g}><Check size={15} /> {g}</li>)}</ul>
          <p className="tc-guide-note">
            Only students of the college can post. The administrator reviews the Talent Corner and removes anything
            that breaks these rules; serious or repeated misuse leads to the account being blocked or deleted.
          </p>
        </div>
        <div className="tc-modal-foot">
          <button type="button" className="tc-btn tc-btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
