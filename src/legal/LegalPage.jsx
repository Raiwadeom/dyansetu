import React, { useEffect } from "react";
import { ArrowLeft, Shield, FileText, Mail } from "lucide-react";

/* ============================================================================
   DnyanSetu — Privacy Policy and Terms of Service

   Both documents share a layout, so they share a component. The content is
   written to describe what the platform actually does: accounts held in
   Firebase, quiz attempts stored per student, notes uploaded by faculty.
   ========================================================================== */

const CONTACT_EMAIL = "smuiqac@gmail.com";

const PRIVACY = {
  eyebrow: "Privacy Policy",
  icon: Shield,
  title: "How we handle your information",
  intro:
    "This policy explains what DnyanSetu collects, why it is collected, and the control you have over it. It applies to every student, faculty member and administrator who uses the platform.",
  sections: [
    {
      heading: "What we collect",
      body: [
        "When you create an account we store your name, email address and, if you choose to add one, your phone number. Students may additionally record their degree, branch, graduating year and areas of interest. Faculty may record their designation, department, qualification and public academic profile links.",
        "As you use the platform we record the practice tests and examinations you attempt, the score for each, and which questions were served so that a retake gives you fresh questions rather than repeats.",
        "Faculty uploads — study notes and question papers — are stored together with the name of the member of staff who uploaded them.",
      ],
    },
    {
      heading: "What we do not collect",
      body: [
        "We do not collect your password. Authentication is handled by our infrastructure provider, which stores only a cryptographic hash; nobody at the college can read your password.",
        "We do not use advertising trackers, and we do not build behavioural profiles for marketing.",
      ],
    },
    {
      heading: "Why we hold it",
      body: [
        "Account details identify you and decide what you can see: a student sees their own results, a faculty member manages their own uploads, an administrator oversees accounts.",
        "Assessment records let you resume where you left off on any device, and let the college understand how its cohorts are progressing.",
      ],
    },
    {
      heading: "Who can see it",
      body: [
        "Your profile and your assessment records are visible to you and to the platform administrator. They are not visible to other students.",
        "Study notes and question papers are published deliberately by faculty and are readable by anyone using the platform, including visitors who are not signed in.",
        "We do not sell personal information, and we do not share it with third parties for their own purposes.",
      ],
    },
    {
      heading: "Where it is stored",
      body: [
        "Data is held in a managed database with access rules enforced at the database itself, so a request for someone else's record is refused rather than merely hidden by the interface. Traffic between your device and the platform is encrypted in transit.",
      ],
    },
    {
      heading: "Your choices",
      body: [
        "You can correct your profile at any time from your account. If you would like your account and its records removed, write to us at the address below and we will action it.",
        "Practice attempts taken while signed out are stored only in that browser and never reach our servers.",
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "If this policy changes materially we will make the updated version available here before the change takes effect.",
      ],
    },
  ],
};

const TERMS = {
  eyebrow: "Terms of Service",
  icon: FileText,
  title: "The terms you agree to when you use DnyanSetu",
  intro:
    "DnyanSetu is an academic platform operated for the students and faculty of the institution. By creating an account or using the platform you accept these terms.",
  sections: [
    {
      heading: "Who may use the platform",
      body: [
        "Accounts are intended for students and faculty of the institution. You are responsible for the accuracy of the details you provide and for keeping your password to yourself.",
        "You must not share your account, attempt to access another person's account, or misrepresent your role.",
      ],
    },
    {
      heading: "Academic use",
      body: [
        "Practice tests and examinations are learning tools. Attempting them on behalf of another student, or automating attempts, undermines their purpose and may lead to the account being restricted.",
        "Results shown on the platform are a guide to your preparation. They are not, by themselves, an official academic record of the university.",
      ],
    },
    {
      heading: "Uploaded material",
      body: [
        "Faculty who upload notes and question papers confirm that they hold the right to share that material with students.",
        "Do not upload anything that infringes copyright, breaches examination confidentiality, or contains personal information about a third party.",
        "Material uploaded in error can be deleted by the member of staff who uploaded it, and by an administrator. Deletion removes both the record and the stored files.",
      ],
    },
    {
      heading: "Acceptable behaviour",
      body: [
        "Do not attempt to disrupt the service, probe it for vulnerabilities without permission, or use it to distribute malicious files.",
        "If you find a security problem, please report it to us rather than acting on it.",
      ],
    },
    {
      heading: "Availability",
      body: [
        "We aim to keep the platform available, but it is provided as it stands. Access may be interrupted for maintenance, and features may change as the platform develops.",
      ],
    },
    {
      heading: "Suspension",
      body: [
        "An account may be restricted where these terms are breached. Where the reason is a misunderstanding, contact us and we will review it.",
      ],
    },
    {
      heading: "Contact",
      body: [
        "Questions about these terms should be sent to the address below.",
      ],
    },
  ],
};

export default function LegalPage({ kind, onBack }) {
  const doc = kind === "terms" ? TERMS : PRIVACY;
  const Icon = doc.icon;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [kind]);

  return (
    <main className="legal-page">
      <div className="resource-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="resource-head-copy">
          <p className="section-eyebrow"><Icon size={14} /> {doc.eyebrow}</p>
          <h1 className="resource-title">{doc.title}</h1>
          <p className="resource-sub">{doc.intro}</p>
        </div>
      </div>

      <article className="legal-body">
        {doc.sections.map((section, index) => (
          <section className="legal-section" key={section.heading}>
            <h2>
              <span className="legal-number">{String(index + 1).padStart(2, "0")}</span>
              {section.heading}
            </h2>
            {section.body.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>
        ))}

        <section className="legal-contact">
          <h2><Mail size={17} /> Get in touch</h2>
          <p>
            For any question about this document, or to request changes to your records, write to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
