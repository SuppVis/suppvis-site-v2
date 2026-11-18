# Site copy outside the spec, for clinical and counsel review

Every piece of text on the restructured site (/, /portal, /patients, /about,
nav, footer) that is NOT verbatim from `docs/CLINIC_PAGE_SPEC_v2.md`. Section
copy from the spec is not repeated here. The former /clinics page is now the
homepage (/); /clinics 301s to /.

Rules applied to everything below:
- Generic and illustrative only: no names, no dates (relative days only), round values
- No real brand or product names in any mockup ("Medication A", "Peptide B", "herbal extract" are deliberate placeholders)
- No text implying a benefit or outcome from any item; items appear only as logged data (name, dose, timing, adherence)
- No em dashes or en dashes

Source file for each block is listed so edits can be made in one place.

---

## 1. Hero split visual
`app/_home/sections/HeroSplitVisual.tsx`

### Left panel: the first 20 minutes of a visit today
Panel label (from spec): "The first 20 minutes of a visit today"

Clock face: decorative SVG, no text. The first 20 minutes of the dial are shaded, with one dot per question below.

Intake questions, each with a minute marker:
| Marker | Question |
|---|---|
| min 1 | So, what's been going on since last time? |
| min 4 | Which supplements are you taking right now? |
| min 7 | Are you still on the full dose? |
| min 10 | When did that first start? |
| min 13 | Better or worse than last month? |
| min 16 | How has your sleep been? |
| min 19 | Did anything else change? |

### Right panel: pre-visit brief, already complete
- Panel label: "Pre-visit brief"
- Badge: "Ready before the visit"
- Section label: "At a glance"
  - Incidents logged: 3
  - Largest score change: Sleep, down 12
  - Check-in coverage: 26 of 30 days
  - Open flags: 2
- Section label: "Regimen, plan vs actual"
  - Magnesium, evening: 27 of 30 days
  - Vitamin D3, morning: 22 of 30 days
  - Omega-3, with meals: 15 of 30 days
- Section label: "Questions for the visit"
  - What happened on days 20 to 23, when check-ins paused?
  - Is the patient-added herbal extract still being taken?

---

## 2. Pre-visit brief walkthrough (section 3)
`app/_home/sections/BriefMockup.tsx`

Callout titles and body text are verbatim from the spec. The brief document itself contains:

### Brief header
- "Pre-visit brief"
- "30 days since last visit · from the patient's daily record"

### Block 1: At a glance
- Incidents logged: 3
- Largest score change: Sleep, down 12
- Check-in coverage: 26 of 30 days
- Open flags: 2

### Block 2: Incidents
- Chip: "Incident"
- "Dizziness, day 18"
- "Severity 3 of 5"
- Label: "In the 72 hours before"
  - "Started: herbal extract, patient-added, day 16" (source tag: log)
  - "Missed: morning item, 2 of 3 days" (source tag: log)
  - "Sleep: 5.5 h, against a 7 h average" (source tag: wearable)
  - "Patient note: "Long travel day."" (source tag: check-in)
- Chip: "Association"
- "Timing only, not a conclusion"

The source tags ("log", "wearable", "check-in") illustrate spec section 9: every line links back to its source.

### Block 3: Regimen, plan vs actual
- Group label: "Treatment plan"
  - Magnesium · 200 mg, evening · 27 of 30 days
  - Vitamin D3 · 2,000 IU, morning · 22 of 30 days
  - Medication A · As prescribed, daily · 30 of 30 days
  - Peptide B · 3 times weekly · 10 of 12 doses
- Group label: "Added by patient"
  - Herbal extract · 1 capsule, daily · 14 of 14 days · chip: "Interaction flagged"

The interaction chip does not name the interacting pair or describe a mechanism.

### Block 4: The whole person
| Domain | Status | Acuity |
|---|---|---|
| Sleep | Changed | Acute |
| Nutrition and hydration | Stable | |
| Movement | Changed | Chronic |
| Mind and mood | Stable | |
| Substances | Stable | |
| Environment and cycles | Changed | Acute |
| Gut | Stable | |
| Medications and supplements | Changed | Acute |

### Block 5: Supporting and in the way
- Block title: "Supporting and in the way"
- Column label: "Associated with better days" (wording from spec callout 5)
  - Evening walk logged
  - Consistent bedtime
  - Check-in before noon
  - REVIEW NOTE: only habits are listed here, no supplements or medications, so no item is presented as producing a benefit. Please confirm the "associated with better days" column is acceptable in a mockup.
- Column label: "In the way"
  - Most skipped: midday item, 9 of 30 days
  - Logging gap: days 20 to 23
  - Noted barrier: "Hard to fit around work."

### Block 6: Questions for the visit
- Q1: What happened on days 20 to 23, when check-ins paused?
- Q2: Is the patient-added herbal extract still being taken?
- Q3: Was anything else different on the day 18 travel day?

---

## 3. Vignette timelines (sections 5 and 6)
`app/_home/sections/Vignettes.tsx`

Decorative SVGs only, with no text (aria-hidden).
- Pregnancy: 270 thin ticks with 12 visit markers.
- Incident: a baseline with six irregular incident markers, each with a dashed "look-back" window before it.

---

## 4. Between visits alert mockup (section 8)
`app/_home/sections/BetweenVisits.tsx`

- Label: "Alerts"
- Segmented control: "All activity" / "Safety only" (selected) / "None" (options are from the spec)
- Card: "Safety alert": "New patient-added item interacts with a current item. Flagged for your review."
- Card: "Your flag": "Ask about the logging gap. Surfaces at the top of the next brief."

COUNSEL NOTE: the safety alert example deliberately matches the spec's single alert trigger (patient adds something that interacts with what they already take). Review alongside section 8.

---

## 5. Founding-practice form (section 12)
`app/_home/FoundingPracticeForm.tsx`, options in `app/lib/clinicOptions.ts`

Field labels (fields fixed by spec):
- Practice name
- Role and credential (placeholder: "e.g. ND, practice owner")
- Email
- Practice type, options:
  - Naturopathic
  - Integrative or functional medicine
  - Nurse practitioner practice
  - Multi-provider practice
  - Other
- Do you currently dispense through Fullscript, Wellevate, or other? Options:
  - Fullscript
  - Wellevate
  - Other (shows a follow-up field: "Which dispensary?")
  - We don't currently dispense

Button: "Join the founding practices" ("Sending..." while submitting)

Success state:
- "Request received."
- "A member of the SuppVis team will reach out to your practice directly."

Errors come from the server and are generic, such as "Practice name is required." and "This form is temporarily unavailable. Please try again later."

---

## 6. Book a demo placeholder page
`app/demo/page.tsx` at /demo (temporary; deleted once the real calendar link exists; /clinics/demo 301s here)

- Heading: "Book a demo"
- Body: "Demo scheduling opens here shortly. In the meantime, join the founding practices and we'll reach out to find a time."
- Button: "Join the founding practices"

---

## 7. Metadata
- Site default (`app/layout.tsx`): title "SuppVis | The between-visits record for practitioners and their patients"; description "Patients log what they take, what they do, and how they feel, in about a minute a day. Their practitioner gets the history as a pre-visit brief."
- / (`app/page.tsx`): title "SuppVis for Practices | Walk in with the history already taken"; description adapted from the hero subhead (unchanged). No noindex in code: indexing is a publish-checklist item.
- /portal, /patients, /about: see each page file; descriptions repeat page copy below.

## 8. Global nav and footer
`app/components/Nav.tsx`, `app/components/Footer.tsx`, `app/components/BoundaryStatement.tsx`
- Nav: For practices / How the portal works / For patients / Research / About; CTA "Book a demo"
- Footer Product: For practices, Portal, For patients, Research, Sources. Company: About. Legal: Privacy Policy, Terms of Use, Affiliate Disclosure, Medical Disclaimer
- Removed: Shop, Blog, Partnerships, newsletter placeholder, "As an Amazon Associate" line
- Spec section 13 boundary statement renders above the footer on every page (and on 404 and /unsubscribe, which have no footer)

## 9. Homepage hero link to patients
`app/_home/sections/ClinicsHero.tsx`
- Pill above the H1: "Keeping a record for your own health?" (phone: "Keeping your own record?") + "For patients →" (links /patients)

## 10. /portal
`app/portal/page.tsx`. Each section has a "Portal demo" placeholder frame (`app/components/PortalFrame.tsx`) with the caption listed.
- Hero H1: "A full roster. No time to prepare."
- Hero sub: "The chart shows what you prescribed, not what happened next. Most days there is no time to find out before the door opens. Open one page per patient and walk in current."
- Your roster: "Your day starts with a list of names and very little else. Who checked in this month? Who went quiet? Who added something new?" / "The roster answers that in one view. Every patient your practice has enrolled, with recent check-in coverage and open flags beside each name." Caption: "The roster: every enrolled patient, with coverage and open flags."
- The pre-visit brief: "Before each visit, the portal assembles one brief from the patient's record, ordered the way you work a case. See the full walkthrough of the brief on the practices page." (links /#pre-visit-brief) Caption: "A pre-visit brief, opened from the roster."
- Plan versus actual: "You write a protocol. Then you wait a month to hear how it went, and what you hear is a guess." / "The portal sets your plan beside what the patient actually took, day by day, with dose and frequency. Anything they added on their own sits apart, marked as an extra." Caption: "Your plan items beside days actually taken, with extras kept separate."
- Interaction flags: "Patients add things between visits. You often hear about it late, or not at all." / "Every logged combination is screened against a clinically reviewed interaction library and flagged as it is logged. Any flag from a rule still awaiting clinical review is labeled unreviewed. What a flag means for the patient is your call." Caption: "A flag on a newly logged item, with its review status shown."
- The timeline: "Recall collapses a month into one sentence. The timeline keeps it in order." / "Items started, stopped, and missed. Incidents with severity and the patient's notes. Sleep and activity from their wearable. Open it when you choose, flag anything, and your flag surfaces at the top of their next brief." Caption: "One patient's month, in order, with your flags pinned for the next visit."
- Patterns and key findings: "Some changes only show up across weeks, and no one has time to read weeks of logs." / "The portal proposes timing associations from the patient's own record, labeled as associations, never causes. Each one links back to the entries it came from. Which ones matter is yours to judge." Caption: "Proposed associations, each linked to the entries behind it."
- CTA band: "See it with your own roster in mind." / "Book a demo and we'll walk through the portal with you. Or join the founding practices and we'll reach out." Buttons: Book a demo / Join the founding practices (links /#founding-practices)
- DEMO PARITY NOTE: every claim here falls under spec gate 3.

## 11. /patients (rewritten for the clinic-contract model)
`app/patients/page.tsx`, mockups in `app/patients/mockups.tsx`, form in `app/components/WaitlistClose.tsx`. Structure follows the /patients hub section of the spec.
- Metadata description: "SuppVis is where your health lives day to day. One minute a day, everything in one place, and if your practice uses SuppVis, part of your care."
- Hero H1: "Where your health lives, day to day." Sub: "What you take, what you do, and how you feel, in one place. One minute a day." Buttons: "Get Early Access" (#waitlist), "See how it works ↓" (#part-of-your-care)
- Part of your care: "If your practitioner's practice uses SuppVis, joining is part of getting care. Your practice sets you up. You download the app and accept your practice's invitation." / "From there, your daily record builds. Your practitioner walks into each visit already current on how the weeks went, instead of starting from what you can remember." / "You can always see everything in your own record."
  - Care mockup: "Your practice", "Connected" pill, "Set up as part of your care."; rows: "Your plan" (3 items from your practitioner), "Your daily record" (Day 12), "Reminders" (At times you set)
- Your day: "The check-in takes under a minute. Check off what you took and what you did. Score how you feel. Note anything out of the ordinary." / "Then answer one question: "Did you do anything different today?" A trip, a new food, a hard week, a short night. That is usually the part everyone forgets."
  - Check-in mockup (unchanged): "Today's check-in", "Day 12"; "What you took and did": Magnesium (Evening, checked), Vitamin D3 (Morning, checked), Evening walk (Habit, unchecked); "How you feel": Sleep 6 of 10, Energy 7 of 10, Mood 7 of 10; "Did you do anything different today?": "Long travel day."
- Your hub: "Beyond the check-in, the app keeps the rest of your health in one place. We don't sell supplements, and no company pays to influence what you see." Tiles:
  - "Your plan and reminders." "The schedule you and your practitioner set, in one place. Reminders follow your schedule, at the times you choose, and you can change them or turn them off."
  - "Knowledge you can trust." "Research-backed deep dives for the supplements you take, drawn from the public library of 33,000+ peer-reviewed studies." (links /research; no per-supplement coverage count, since the browse shows fewer than 453 after reclassified-medication exclusions)
  - "Your bloodwork over time." "Lab results trended across draws, shown exactly as your lab reported them. What they mean is a conversation with your practitioner."
  - "Your goals and what moves them." "Daily scores across your goals, and what in your record is associated with the changes. Labeled as associations, not causes."
  - "Your biometrics." "Sleep, HRV, and activity from the wearables you already use, alongside everything you log."
  - "Checked for safety." "Everything you log is screened against your medications, and anything worth discussing is flagged for you and your practitioner." **FLAG FOR CLINICAL REVIEW: safety statement.**
- On your own, too: "If your practice doesn't use SuppVis, the app works on its own. Same check-in, same hub, same record." / "We're building a clinical handoff: a summary of your record you'll be able to print or send, so any doctor you see can get the full picture of what you've been doing." (not built: future tense, no dates)
- Waitlist (existing form and handler, anchor #waitlist, unchanged): "Start keeping the record." / "Join the beta. Get early access to the app and help shape SuppVis."
- Removed with the old sharing model: "Your account is yours." section and its sharing mockup ("Invite code", "Sharing on", "Stop sharing at any time"); "What you get back." tiles; "The app." tiles, including "SuppVis is an iOS app" (interaction screening returns as the "Checked for safety." hub tile)
- DEMO PARITY NOTE: bloodwork trending, goals, reminders, wearables, and medication screening fall under spec gate 3.

## 12. /about
`app/about/sections/*`. FounderProfiles is unchanged, word for word.
- Origin: "When they choose to share" now "Through their practice"; "The patient owns the account, and sharing it is always their choice." deleted; closing now "for the patient and the practitioner caring for them." Meta description ends "for patients and the practitioners caring for them."
- Hero paragraph: "SuppVis was built by two brothers. One managing Type 1 diabetes and building the system. The other in naturopathic training, doing its clinical review. Both saw how much of a person's health happens between appointments, and how little of it reaches the person caring for them."
- "Why SuppVis exists" rewritten around the between-visits record and the practitioner portal; one paragraph on the app as the patient side; independence paragraph kept. Removed the "$69.3 billion in 2024" market figure.
- Values: "Judgment stays with the clinician." / "The record starts with the patient." ("Every entry comes from the person living it, a minute a day. Their practitioner reads it; the patient can always see everything in their own record.") / "Science you can audit."
- Vis line: "SuppVis was built to make that force easier to see. Through a daily record, not guesswork."
- CTA: "This is the record we wanted. Now it's yours." / "Practitioners can book a demo of the portal. Patients can join the beta of the app. Either way, you talk directly to us." Buttons: Book a demo / For patients. "Founding pricing locked forever" removed.

## 13. Homepage: clinic-contract model
- Patient-side tile (`app/_home/sections/PatientSide.tsx`, spec section 4), replaces "They stay in control.": "Enrolled through your practice." / "Patients join SuppVis because you bring them on as part of their care. They download the app, accept your practice's invitation, and their between-visit record is connected to your portal from the first day."
- Three-step strip (`app/_home/sections/PracticeSteps.tsx`, spec section 11A, directly before the CTA band, anchor #how-it-works). Header: "How it works with your practice". Cards numbered 01 to 03:
  - "Partner with SuppVis." "Your practice signs on and gets the portal."
  - "Bring your patients on." "You enroll patients as part of their care; their daily record starts building immediately."
  - "Walk in current." "Every visit opens with the pre-visit brief instead of history-taking."
