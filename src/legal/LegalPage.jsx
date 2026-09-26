import React, { useEffect } from "react";
import { ArrowLeft, Shield, FileText, Mail } from "lucide-react";

import { useLang } from "../lib/i18n";
import { LEGAL_UI_MR, PRIVACY_MR, TERMS_MR } from "./legalMarathi";

/* ============================================================================
   DnyanSetu — Privacy Policy and Terms of Service

   Both documents share a layout, so they share a component. The content is
   written to describe what the platform actually does: accounts held in
   Supabase, quiz attempts stored per student, notes uploaded by faculty, and
   the RaktSetu blood-donation network.

   A section with an `id` gets that anchor, so /terms#raktsetu links straight
   to the RaktSetu terms (the sign-up checkbox and RaktSetu pages use it).
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
        "We do not collect your password. Authentication is handled by our infrastructure provider (Supabase), which stores only a cryptographic hash; nobody at the college can read your password. If you sign in with Google, we receive only your name and email address from Google.",
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
      id: "raktsetu",
      heading: "RaktSetu (blood donation) — additional note",
      body: [
        "RaktSetu is only for people aged 18 and over. If you join it, we store your age, gender, weight, blood group, city, an optional phone number, the date of your last donation (if you give one), your health self-declaration, and your alert preferences. Blood group and health information are sensitive; we collect them only with your explicit consent in the RaktSetu profile form, and only to show and match blood requests.",
        "Nobody else can see your RaktSetu profile. Matching is done by our server. A requester sees your name and phone number only if you tap “I can help” on their request, and you see the requester's phone only after you do the same. Phone numbers are never included in notifications or emails.",
        "If you post a request, the patient name, blood group, units, hospital, address, city and needed-by time are shown to signed-in RaktSetu members until the request closes. Your contact number is shown only to volunteers who respond.",
        "Browser notifications are sent through your browser's push service (for example Google or Apple). Emails are sent through our email provider (Resend). Each browser you turn alerts on in is stored so alerts can reach it after you close the tab; turn them off in RaktSetu → Alerts.",
        "You can delete all your RaktSetu data at any time from RaktSetu → Alerts → “Delete my RaktSetu data”, or by writing to the address below. Your DnyanSetu account is not affected.",
        "How long we keep it. The contact number on a request is erased automatically 30 days after the request closes. A RaktSetu profile that has not been updated for 12 months is deleted automatically, together with its alert subscriptions. We record the date and version of the consent you gave, and a log of moderation actions, so we can show how your data was handled if you ask.",
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
        "Accounts are intended for students and faculty of the institution. You must be at least 13 years old to use DnyanSetu. You are responsible for the accuracy of the details you provide and for keeping your password to yourself.",
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
      id: "raktsetu",
      heading: "RaktSetu — student blood-donation network",
      body: [
        "What it is. RaktSetu is a community network that connects people who are looking for blood donors with volunteers registered on DnyanSetu. It is run by students and staff as a social service, free of charge.",
        "What it is not. RaktSetu does not give medical advice, diagnosis or treatment. It is not a blood bank, it does not collect, test, store or supply blood, and it cannot guarantee that any donor will respond or that a donation will take place. In an emergency, contact the hospital and its blood bank directly. Any donation happens only at a licensed blood bank or hospital, which decides final eligibility after its own screening.",
        "Who may use it. You must be 13 or older to use DnyanSetu, but RaktSetu is only for people aged 18 and over — the profile form will not accept a younger age. To volunteer as a donor you must be 18 to 65 years old, weigh at least 45 kg, be in good health, and truthfully confirm the health declaration in your profile. After a donation you may not volunteer again for 4 months; RaktSetu applies this automatically once a donation is recorded.",
        "What we collect and why. Your age, gender, weight, blood group, city, optional phone number, last donation date and health declaration — to check eligibility and to show and match blood requests near you. See the RaktSetu note in the Privacy Policy.",
        "Who can see it. Your RaktSetu profile is visible only to you. A requester sees your name and phone only if you tap “I can help” on their request. A requester's phone is shown only to volunteers who respond. Phone numbers are never put in notifications or emails.",
        "Alerts and consent. Browser notifications and emails are sent only if you opt in. Turn browser notifications on or off, choose your city or all cities, and turn email off in RaktSetu → Alerts, or use the unsubscribe link in any alert email.",
        "Requester responsibility. Post a request only for a real, current need, with correct details, and confirm it is genuine. You may post at most 3 requests in 24 hours; requests close automatically after their needed-by time. Mark a request fulfilled or cancel it once it is no longer needed.",
        "Prohibited. Fake, test, duplicate or spam requests; asking for or offering money, gifts or any payment; and buying or selling blood — which is illegal in India. Never pay anyone for blood through RaktSetu. Requests can be reported, and the administrator may remove any request and restrict any account that breaks these rules.",
        "Safety measures. To prevent misuse, RaktSetu automatically refuses requests that mention money, UPI, bank details or fees; limits each member to offering help on 10 requests in 24 hours so phone numbers cannot be collected in bulk; hides any request reported by 3 members until a moderator reviews it; marks requests from accounts less than a day old as \u201cNew member\u201d; and records every moderation action (who acted, when and why).",
        "Emergencies. RaktSetu is not an emergency service and must never be the only place you look for blood. In an emergency, contact the hospital\u2019s blood bank directly, call the 104 health helpline, or check live blood availability on the Government of India\u2019s e-RaktKosh portal (eraktkosh.mohfw.gov.in).",
        "Deleting your data. You can delete your RaktSetu profile, alert subscriptions, responses and requests at any time from RaktSetu → Alerts → “Delete my RaktSetu data”, or ask us to delete them, or your whole DnyanSetu account, by writing to the address below. Complaints about how your data is handled can also be sent there.",
      ],
    },
    {
      id: "grievance",
      heading: "Grievance Officer",
      body: [
        "Complaints about content, misuse of RaktSetu, or how your personal data is handled can be sent to the Grievance Officer: the DnyanSetu Administrator, Chhatrapati Shivajiraje Mahavidyalaya, Udgir \u2014 smuiqac@gmail.com.",
        "We acknowledge every complaint within 24 hours and aim to resolve it within 15 days. Requests that break these terms (fake requests, requests for money, harassment) are removed as soon as they are confirmed.",
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
  /* Follows the site language (EN / मराठी); the Marathi text lives in
     legalMarathi.js with the same sections and anchors. */
  const { lang } = useLang();
  const mr = lang === "mr";
  const doc = kind === "terms" ? (mr ? TERMS_MR : TERMS) : (mr ? PRIVACY_MR : PRIVACY);
  const Icon = kind === "terms" ? FileText : Shield;

  useEffect(() => {
    /* /terms#raktsetu (from the sign-up checkbox) lands on that section. */
    const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [kind, lang]);

  return (
    <main className="legal-page" lang={mr ? "mr" : "en"}>
      <div className="resource-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> {mr ? LEGAL_UI_MR.back : "Back"}
        </button>
        <div className="resource-head-copy">
          <p className="section-eyebrow"><Icon size={14} /> {doc.eyebrow}</p>
          <h1 className="resource-title">{doc.title}</h1>
          <p className="resource-sub">{doc.intro}</p>
        </div>
      </div>

      <article className="legal-body">
        {doc.sections.map((section, index) => (
          <section className="legal-section" key={section.heading} id={section.id}>
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
          <h2><Mail size={17} /> {mr ? LEGAL_UI_MR.contactHeading : "Get in touch"}</h2>
          {mr ? (
            <p>
              {LEGAL_UI_MR.contactBefore}{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. {LEGAL_UI_MR.contactAfter}
            </p>
          ) : (
            <p>
              For any question about this document, to request changes to or deletion of your records, or to
              make a complaint about how your data is handled, write to{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We aim to reply within 7 days.
            </p>
          )}
        </section>
      </article>
    </main>
  );
}
