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
- "30 days since last visit · shared by the patient"

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
- Site default (`app/layout.tsx`): title "SuppVis | The between-visits record for practitioners and their patients"; description "Patients log what they take, what they do, and how they feel, in about a minute a day. When they choose to share, their practitioner gets the history as a pre-visit brief."
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
- Your roster: "Your day starts with a list of names and very little else. Who checked in this month? Who went quiet? Who added something new?" / "The roster answers that in one view. Every patient who shares with you, with recent check-in coverage and open flags beside each name. Patients join by invite code, and sharing is always their choice." Caption: "The roster: every sharing patient, with coverage and open flags."
- The pre-visit brief: "Before each visit, the portal assembles one brief from the patient's record, ordered the way you work a case. See the full walkthrough of the brief on the practices page." (links /#pre-visit-brief) Caption: "A pre-visit brief, opened from the roster."
- Plan versus actual: "You write a protocol. Then you wait a month to hear how it went, and what you hear is a guess." / "The portal sets your plan beside what the patient actually took, day by day, with dose and frequency. Anything they added on their own sits apart, marked as an extra." Caption: "Your plan items beside days actually taken, with extras kept separate."
- Interaction flags: "Patients add things between visits. You often hear about it late, or not at all." / "Every logged combination is screened against a clinically reviewed interaction library and flagged as it is logged. Any flag from a rule still awaiting clinical review is labeled unreviewed. What a flag means for the patient is your call." Caption: "A flag on a newly logged item, with its review status shown."
- The timeline: "Recall collapses a month into one sentence. The timeline keeps it in order." / "Items started, stopped, and missed. Incidents with severity and the patient's notes. Sleep and activity from their wearable. Open it when you choose, flag anything, and your flag surfaces at the top of their next brief." Caption: "One patient's month, in order, with your flags pinned for the next visit."
- Patterns and key findings: "Some changes only show up across weeks, and no one has time to read weeks of logs." / "The portal proposes timing associations from the patient's own record, labeled as associations, never causes. Each one links back to the entries it came from. Which ones matter is yours to judge." Caption: "Proposed associations, each linked to the entries behind it."
- CTA band: "See it with your own roster in mind." / "Book a demo and we'll walk through the portal with you. Or join the founding practices and we'll reach out." Buttons: Book a demo / Join the founding practices (links /#founding-practices)
- DEMO PARITY NOTE: every claim here falls under spec gate 3.

## 11. /patients
`app/patients/page.tsx`, mockups in `app/patients/mockups.tsx`, form in `app/components/WaitlistClose.tsx`
- Hero H1: "A lot happens between appointments." Sub: "You remember some of it. By the time you sit down with your practitioner, most of it is gone. SuppVis keeps the record for you, in about a minute a day." Buttons: "Get Early Access" (#waitlist), "See how it works ↓"
- One minute a day: "Open the app once a day. Check off what you took and what you did. Score how you feel. Note anything out of the ordinary." / "Then answer one question: "Did you do anything different today?" A trip, a new food, a hard week, a short night. That is usually the part everyone forgets."
  - Check-in mockup: "Today's check-in", "Day 12"; "What you took and did": Magnesium (Evening, checked), Vitamin D3 (Morning, checked), Evening walk (Habit, unchecked); "How you feel": Sleep 6 of 10, Energy 7 of 10, Mood 7 of 10; "Did you do anything different today?": "Long travel day."
- What you get back: "A few weeks in, you have something most people never get: a clear record of your own days." Tiles: "Your days, in order." / "Patterns from your own record." ("SuppVis points out timing patterns in your own days and labels them as patterns. Not promises, and not conclusions.") / "A history you can share."
- Your account is yours (no HIPAA language): "Not your practitioner's. Not a clinic's. You own your SuppVis account." / "You choose whether to share it, and with whom, using an invite code. You can stop sharing at any time." / "We don't sell supplements, and no company pays to influence what you see."
  - Sharing mockup: "Sharing", "You decide who sees your record.", "Invite code" (masked), "Your practitioner" / "Sharing on" toggle, "Stop sharing at any time"
- The app: "SuppVis is an iOS app. It keeps supplements, medications, habits, and how you feel in one place. Every insight links to the research behind it, in a public library of 33,000+ peer-reviewed studies, covering 453 supplements and 89 research-backed habits." Tiles: "Your plan, and your extras." / "Your devices fill in the rest." / "Screened as you log." ("...If something is flagged, bring it to your care team.")
- Waitlist (existing form and handler, anchor #waitlist): heading now "Start keeping the record."; sub "Join the beta. Get early access to the app and help shape SuppVis."; removed "Free during beta" and "Founding pricing locked forever"; kept "Your feedback shapes the product"

## 12. /about
`app/about/sections/*`. FounderProfiles is unchanged, word for word.
- Hero paragraph: "SuppVis was built by two brothers. One managing Type 1 diabetes and building the system. The other in naturopathic training, doing its clinical review. Both saw how much of a person's health happens between appointments, and how little of it reaches the person caring for them."
- "Why SuppVis exists" rewritten around the between-visits record and the practitioner portal; one paragraph on the app as the patient side; independence paragraph kept. Removed the "$69.3 billion in 2024" market figure.
- Values: "Judgment stays with the clinician." / "The patient owns the record." / "Science you can audit."
- Vis line: "SuppVis was built to make that force easier to see. Through a daily record, not guesswork."
- CTA: "This is the record we wanted. Now it's yours." / "Practitioners can book a demo of the portal. Patients can join the beta of the app. Either way, you talk directly to us." Buttons: Book a demo / For patients. "Founding pricing locked forever" removed.
