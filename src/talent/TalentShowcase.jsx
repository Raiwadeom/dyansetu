import React, { useEffect, useState } from "react";
import { ArrowRight, Feather, Heart, MessageCircle, Plus, Quote, Sparkles, Video, Play } from "lucide-react";

import { fetchTalentPosts, youTubeId } from "../lib/talent.js";
import "./talent.css";

/* Landing-page teaser for the Talent Corner: the three sections and the
   newest posts. Everything opens the full page (/talent). */
const CATS = [
  { id: "poem", icon: Feather, name: "Poems", nameMr: "कविता", blurb: "Verses in Marathi, Hindi and English.", blurbMr: "मराठी, हिंदी व इंग्रजीतील कविता." },
  { id: "shayari", icon: Quote, name: "Shayari", nameMr: "शायरी", blurb: "Lines that say a lot in a little.", blurbMr: "थोडक्यात खूप सांगणाऱ्या ओळी." },
  { id: "content", icon: Video, name: "Content Creation", nameMr: "कंटेंट क्रिएशन", blurb: "Reels, vlogs, art and short films.", blurbMr: "रील्स, व्लॉग, कला व लघुपट." },
];

export default function TalentShowcase({ tr, onOpen, onShare, canShare }) {
  const [latest, setLatest] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchTalentPosts({ limit: 3 }).then((l) => { if (alive) setLatest(l); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <section className="tc-showcase" id="talent-corner">
      <div className="tc-sc-inner">
        <div className="tc-sc-head">
          <div>
            <p className="tc-eyebrow"><Sparkles size={14} /> {tr("Student Talent Corner", "विद्यार्थी कला मंच")}</p>
            <h2 className="tc-sc-title">{tr("Poems, shayari & creators of our campus", "आपल्या कॅम्पसच्या कविता, शायरी व क्रिएटर्स")}</h2>
            <p className="tc-sc-sub">
              {tr(
                "Read freely, like, comment and follow. Students log in to share their own work.",
                "मोफत वाचा, लाईक करा, कमेंट करा आणि फॉलो करा. विद्यार्थी लॉग इन करून आपले लेखन शेअर करू शकतात.",
              )}
            </p>
          </div>
          <div className="tc-sc-actions">
            <button type="button" className="tc-btn tc-btn-primary" onClick={canShare ? onShare : onOpen}>
              {canShare ? <><Plus size={16} /> {tr("Share your talent", "तुमची कला शेअर करा")}</> : <>{tr("Explore Talent Corner", "कला मंच पहा")} <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>

        <div className="tc-sc-cats">
          {CATS.map((c) => {
            const Icon = c.icon;
            return (
              <button type="button" key={c.id} className={`tc-sc-cat tc-sc-cat--${c.id}`} onClick={() => onOpen(c.id)}>
                <span className="tc-sc-cat-icon"><Icon size={20} /></span>
                <strong>{tr(c.name, c.nameMr)}</strong>
                <small>{tr(c.blurb, c.blurbMr)}</small>
                <em>{tr("Read now", "आता वाचा")} <ArrowRight size={13} /></em>
              </button>
            );
          })}
        </div>

        {latest.length > 0 && (
          <div className="tc-sc-latest">
            {latest.map((p) => {
              const yt = youTubeId(p.link);
              const thumb = p.images[0]?.url || (yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : "");
              return (
                <button type="button" key={p.id} className={`tc-sc-post tc-card--${p.category}`} onClick={() => onOpen("", p.id)}>
                  {p.category === "content" ? (
                    <span className="tc-sc-thumb">{thumb ? <img src={thumb} alt="" loading="lazy" /> : <Play size={28} />}</span>
                  ) : (
                    <span className="tc-verse"><p>{p.body}</p></span>
                  )}
                  <span className="tc-sc-meta">
                    <strong>{p.title || p.author}</strong>
                    <span><Heart size={13} /> {p.likes} <MessageCircle size={13} /> {p.comments}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
