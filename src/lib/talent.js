/* ============================================================================
   DnyanSetu — Talent Corner (poems, shayari, content creation)

   Posts, likes, comments and follows live in Supabase (migration 0022).
   Everyone can read; signed-in students post after ticking the guidelines;
   any signed-in account likes, comments and follows. Pictures go to
   Cloudinary folder dnyansetu/talent (photos only).
   ========================================================================== */

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";
import { uploadFiles } from "./cloudinary.js";

export const TALENT_CATEGORIES = [
  { id: "poem", label: "Poems", labelMr: "कविता", one: "Poem" },
  { id: "shayari", label: "Shayari", labelMr: "शायरी", one: "Shayari" },
  { id: "content", label: "Content Creation", labelMr: "कंटेंट क्रिएशन", one: "Content" },
];
export const TALENT_LANGUAGES = ["Marathi", "Hindi", "English", "Urdu", "Other"];
export const MAX_TALENT_IMAGES = 3;
export const TALENT_BODY_MAX = 4000;

/* Shown in English or Marathi (toggle on the guidelines box and dialog). */
export const TALENT_GUIDELINES = [
  {
    en: "Strictly no romantic content — no girlfriend / boyfriend, crush, dating, proposals, breakup or love-for-a-partner poems and shayari. Love for family, friends, country, nature and God is welcome.",
    mr: "प्रेमसंबंधाविषयी मजकूर पूर्णपणे बंद — गर्लफ्रेंड / बॉयफ्रेंड, क्रश, डेटिंग, प्रपोज, ब्रेकअप किंवा प्रियकर-प्रेयसीवरील कविता व शायरी नको. आई-वडील, कुटुंब, मित्र, देश, निसर्ग व देवाविषयीचे प्रेम चालेल.",
  },
  {
    en: "Only my own original work, or I clearly credit the real author.",
    mr: "फक्त माझे स्वतःचे लेखन, किंवा मूळ लेखकाचे नाव स्पष्टपणे दिलेले.",
  },
  {
    en: "No adult, sexual or vulgar content of any kind.",
    mr: "कोणत्याही प्रकारचा अश्लील, लैंगिक किंवा असभ्य मजकूर नको.",
  },
  {
    en: "No hate, abuse, bullying or insults about any person, caste, religion or gender.",
    mr: "कोणतीही व्यक्ती, जात, धर्म किंवा लिंग यांबद्दल द्वेष, शिवीगाळ, छळ किंवा अपमान नको.",
  },
  {
    en: "No violence, self-harm, drugs or anything illegal.",
    mr: "हिंसा, स्वतःला इजा, अमली पदार्थ किंवा कोणतीही बेकायदेशीर गोष्ट नको.",
  },
  {
    en: "No politics, spam, ads or links to unsafe sites.",
    mr: "राजकारण, स्पॅम, जाहिराती किंवा असुरक्षित वेबसाइटच्या लिंक नकोत.",
  },
  {
    en: "No one else's photos or personal details without their consent.",
    mr: "दुसऱ्यांचे फोटो किंवा वैयक्तिक माहिती त्यांच्या परवानगीशिवाय नको.",
  },
  {
    en: "I understand the administrator may remove my post and block or delete my account if I break these rules.",
    mr: "हे नियम मोडल्यास ॲडमिन माझी पोस्ट काढू शकतो आणि माझे खाते ब्लॉक किंवा डिलीट करू शकतो, हे मला मान्य आहे.",
  },
];

/* First line of defence (the administrator is the real filter): adult and
   abusive words, plus romantic / girlfriend-boyfriend words, which the
   Talent Corner does not allow at all. Whole words only, so "bf" never
   matches inside another word. */
const BLOCKED_WORDS = [
  "porn", "xxx", "nude", "nudes", "sex", "sexy", "onlyfans", "18+",
  "chutiya", "madarchod", "behenchod", "bhenchod", "bhosdi", "randi", "gaand", "lund",
  "girlfriend", "boyfriend", "gf", "bf", "crush", "dating", "kiss", "kisses",
  "jaanu", "janu", "babu", "shona", "sanam", "mehbooba", "mehboob", "dilbar", "premika", "premi",
  "प्रेयसी", "प्रेमिका", "गर्लफ्रेंड", "बॉयफ्रेंड", "मेहबूबा", "सनम",
];
const escapeRe = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BLOCKED_RE = new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}])(${BLOCKED_WORDS.map(escapeRe).join("|")})(?=$|[^\\p{L}\\p{M}\\p{N}])`, "iu");
export function looksUnsafe(...texts) {
  return BLOCKED_RE.test(texts.join(" \n "));
}

function toPost(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    author: row.author_name,
    authorGender: row.author_gender || "",
    category: row.category,
    title: row.title || "",
    body: row.body || "",
    language: row.language || "",
    credit: row.credit || "",
    link: row.link_url || "",
    images: Array.isArray(row.images) ? row.images : [],
    likes: row.likes_count || 0,
    comments: row.comments_count || 0,
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  };
}

export async function fetchTalentPosts({ category = "", authorIds = null, authorId = "", limit = 60 } = {}) {
  if (!isBackendConfigured) return [];
  let query = supabase.from("talent_posts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (category) query = query.eq("category", category);
  if (authorId) query = query.eq("author_id", authorId);
  if (authorIds) {
    if (!authorIds.length) return [];
    query = query.in("author_id", authorIds);
  }
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error, "Could not load the Talent Corner."));
  return (data || []).map(toPost);
}

export async function createTalentPost({ author, category, title, body, language, credit = "", link, files, onProgress }) {
  if (!isBackendConfigured) throw new Error("Posting needs the backend configured.");
  if (!author?.id) throw new Error("Sign in to share your talent.");
  const images = files?.length
    ? (await uploadFiles(files, { folder: "dnyansetu/talent", onProgress })).map((f) => ({ url: f.url, name: f.name }))
    : [];
  const { data, error } = await supabase
    .from("talent_posts")
    .insert({
      author_id: author.id,
      author_name: (author.name || "Student").trim().slice(0, 60),
      author_gender: author.gender || "",
      category,
      title: title.trim(),
      body: body.trim(),
      language,
      credit: credit.trim().slice(0, 60),
      link_url: link.trim(),
      images,
      guidelines_accepted_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(friendlyError(error, "Could not share your post."));
  return toPost(data);
}

export async function deleteTalentPost(id) {
  const { error } = await supabase.from("talent_posts").delete().eq("id", id);
  if (error) throw new Error(friendlyError(error, "Could not remove the post."));
}

/* Which of these posts the signed-in account has liked. */
export async function fetchMyLikes(userId, postIds) {
  if (!isBackendConfigured || !userId || !postIds.length) return new Set();
  const { data } = await supabase.from("talent_likes").select("post_id").eq("user_id", userId).in("post_id", postIds);
  return new Set((data || []).map((r) => r.post_id));
}

export async function setLike(postId, userId, liked) {
  const q = liked
    ? supabase.from("talent_likes").insert({ post_id: postId, user_id: userId })
    : supabase.from("talent_likes").delete().eq("post_id", postId).eq("user_id", userId);
  const { error } = await q;
  if (error && error.code !== "23505") throw new Error(friendlyError(error, "Could not save your like."));
}

export async function fetchComments(postId) {
  const { data, error } = await supabase
    .from("talent_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }).limit(200);
  if (error) throw new Error(friendlyError(error, "Could not load the comments."));
  return (data || []).map((r) => ({
    id: r.id, userId: r.user_id, name: r.user_name, body: r.body, createdAt: Date.parse(r.created_at),
  }));
}

export async function addComment(postId, user, body) {
  const { data, error } = await supabase
    .from("talent_comments")
    .insert({ post_id: postId, user_id: user.id, user_name: (user.name || "Member").slice(0, 60), body: body.trim() })
    .select("*").single();
  if (error) throw new Error(friendlyError(error, "Could not post your comment."));
  return { id: data.id, userId: data.user_id, name: data.user_name, body: data.body, createdAt: Date.parse(data.created_at) };
}

export async function deleteComment(id) {
  const { error } = await supabase.from("talent_comments").delete().eq("id", id);
  if (error) throw new Error(friendlyError(error, "Could not remove the comment."));
}

/* Ids this account follows. */
export async function fetchFollowing(userId) {
  if (!isBackendConfigured || !userId) return new Set();
  const { data } = await supabase.from("talent_follows").select("followee_id").eq("follower_id", userId);
  return new Set((data || []).map((r) => r.followee_id));
}

export async function setFollow(userId, followeeId, follow) {
  const q = follow
    ? supabase.from("talent_follows").insert({ follower_id: userId, followee_id: followeeId })
    : supabase.from("talent_follows").delete().eq("follower_id", userId).eq("followee_id", followeeId);
  const { error } = await q;
  if (error && error.code !== "23505") throw new Error(friendlyError(error, "Could not update follow."));
}

export async function fetchFollowerCount(userId) {
  if (!isBackendConfigured) return 0;
  const { count } = await supabase.from("talent_follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", userId);
  return count || 0;
}

/* YouTube links play inline; everything else opens in a new tab. */
export function youTubeId(url = "") {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : "";
}

export function linkHost(url = "") {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.includes("instagram")) return "Instagram";
    if (h.includes("youtu")) return "YouTube";
    if (h.includes("facebook") || h === "fb.watch") return "Facebook";
    if (h.includes("spotify")) return "Spotify";
    if (h.includes("x.com") || h.includes("twitter")) return "X";
    return h;
  } catch { return "Link"; }
}

export function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
