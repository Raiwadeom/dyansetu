import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Code2, ExternalLink, FolderGit2, GraduationCap, Users } from "lucide-react";

import { fetchProjects, kindLabel, platformOf, streamLabel } from "../lib/projects.js";
import ProjectCover from "./ProjectCover.jsx";
import "./projects.css";

/* Landing-page section for Student Projects. Always shown: with projects it
   shows three random ones; before the first one is approved it explains how a
   student's project gets here. */
export default function ProjectsShowcase({ tr, onOpen }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchProjects({ limit: 60 }).then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);

  const all = list || [];
  /* Only three, picked at random each time the page loads, so every project
     gets its turn; the full list is one click away. */
  const latest = useMemo(() => {
    const pool = [...all];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = (k) => all.filter((p) => p.kind === k).length;

  const steps = [
    { n: "1", en: "Build and host it", mr: "प्रकल्प बनवा व होस्ट करा", enSub: "Put your final-year, OJT or mini project online (Vercel, Netlify, GitHub Pages…).", mrSub: "तुमचा अंतिम वर्ष, OJT किंवा मिनी प्रकल्प ऑनलाईन ठेवा (Vercel, Netlify, GitHub Pages…)." },
    { n: "2", en: "Add it from your profile", mr: "प्रोफाईलमधून जोडा", enSub: "Sign in as a student and add the link, a short description and your class.", mrSub: "विद्यार्थी म्हणून साइन इन करा आणि लिंक, थोडक्यात माहिती व वर्ग जोडा." },
    { n: "3", en: "A teacher approves it", mr: "शिक्षक मंजूर करतात", enSub: "Once checked, it appears here for everyone to see.", mrSub: "तपासणीनंतर तो येथे सर्वांना दिसतो." },
  ];

  return (
    <section className="sp-landing" id="student-projects" aria-labelledby="sp-landing-title">
      <div className="sp-landing-in">
        <div className="sp-landing-head">
          <div className="sp-landing-copy">
            <p className="sp-landing-kicker"><Code2 size={15} /> {tr("Student Projects", "विद्यार्थी प्रकल्प")}</p>
            <h2 id="sp-landing-title">{tr("Projects built by our students, live on the internet", "आपल्या विद्यार्थ्यांनी बनवलेले प्रकल्प, इंटरनेटवर लाईव्ह")}</h2>
            <p className="sp-landing-sub">
              {tr(
                "Final-year, OJT and mini projects from our B.Sc., B.Sc. CS and B.A. students. Open any project and see it working.",
                "आमच्या B.Sc., B.Sc. CS व B.A. विद्यार्थ्यांचे अंतिम वर्ष, OJT व मिनी प्रकल्प. कोणताही प्रकल्प उघडून प्रत्यक्ष चालताना पहा.",
              )}
            </p>
          </div>
          <div className="sp-landing-side">
            {list && all.length > 0 && (
              <ul className="sp-landing-counts" aria-label={tr("Project counts", "प्रकल्प संख्या")}>
                <li><strong>{all.length}</strong><span>{tr("Live", "लाईव्ह")}</span></li>
                <li><strong>{count("final-year")}</strong><span>{tr("Final year", "अंतिम वर्ष")}</span></li>
                <li><strong>{count("ojt")}</strong><span>OJT</span></li>
              </ul>
            )}
            <button type="button" className="sp-landing-btn" onClick={onOpen}>
              {tr("See all projects", "सर्व प्रकल्प पहा")} <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {latest.length > 0 ? (
          <div className="sp-landing-grid">
            {latest.map((p) => (
              <article className="sp-lcard" key={p.id}>
                <div className="sp-lshot">
                  {p.image ? <img src={p.image} alt={`Screenshot of ${p.title}`} loading="lazy" /> : <ProjectCover title={p.title} />}
                  <em>{kindLabel(p.kind)}</em>
                </div>
                <div className="sp-lbody">
                  <h3>{p.title}</h3>
                  <p>{p.description}</p>
                  <ul>
                    <li><Users size={14} /><span>{p.students}</span></li>
                    <li><GraduationCap size={14} /><span>{streamLabel(p.stream)}{p.className ? ` · ${p.className}` : ""}</span></li>
                  </ul>
                  {p.live && (
                    <a href={p.live} target="_blank" rel="noopener noreferrer nofollow ugc">
                      <ExternalLink size={14} /> {tr("Open project", "प्रकल्प उघडा")} <small>{platformOf(p.live)}</small>
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <ol className="sp-landing-steps">
            {steps.map((s) => (
              <li key={s.n}>
                <span className="sp-step-no">{s.n}</span>
                <div>
                  <strong>{tr(s.en, s.mr)}</strong>
                  <p>{tr(s.enSub, s.mrSub)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
