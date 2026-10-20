import React, { useEffect, useState } from "react";
import { ArrowRight, Code2 } from "lucide-react";

import { fetchProjects } from "../lib/projects.js";
import "./projects.css";

/* Landing-page strip for Student Projects: a short heading and line on the
   left, the project counts and one button on the right. The projects
   themselves live on the full page. */
export default function ProjectsShowcase({ tr, onOpen }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchProjects({ limit: 60 }).then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);

  const all = list || [];
  const count = (k) => all.filter((p) => p.kind === k).length;

  return (
    <section className="sps" id="student-projects" aria-labelledby="sps-title">
      <div className="sps-in">
        <div className="sps-copy">
          <p className="sps-kicker"><Code2 size={14} /> {tr("Student Projects", "विद्यार्थी प्रकल्प")}</p>
          <h2 id="sps-title">{tr("Built by our students, live on the internet", "आपल्या विद्यार्थ्यांनी बनवलेले, इंटरनेटवर लाईव्ह")}</h2>
          <p className="sps-sub">{tr("Final-year, OJT and mini projects. Open any project and see it working.", "अंतिम वर्ष, OJT व मिनी प्रकल्प. कोणताही प्रकल्प उघडून प्रत्यक्ष चालताना पहा.")}</p>
        </div>
        <div className="sps-side">
          {list && all.length > 0 && (
            <ul className="sp-counts sps-counts" aria-label={tr("Project counts", "प्रकल्प संख्या")}>
              <li><strong>{all.length}</strong><span>{tr("Live", "लाईव्ह")}</span></li>
              <li><strong>{count("final-year")}</strong><span>{tr("Final year", "अंतिम वर्ष")}</span></li>
              <li><strong>{count("ojt")}</strong><span>OJT</span></li>
              <li><strong>{count("mini")}</strong><span>{tr("Mini", "मिनी")}</span></li>
            </ul>
          )}
          <button type="button" className="sps-btn" onClick={onOpen}>
            {tr("See all projects", "सर्व प्रकल्प पहा")} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
