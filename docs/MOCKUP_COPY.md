# /clinics: mockup and UI copy for clinical review

Every piece of text on suppvis.health/clinics that is NOT verbatim from
`docs/CLINIC_PAGE_SPEC_v2.md`. Section copy from the spec is not repeated here.

Rules applied to everything below:
- Generic and illustrative only: no names, no dates (relative days only), round values
- No real brand or product names in any mockup ("Medication A", "Peptide B", "herbal extract" are deliberate placeholders)
- No text implying a benefit or outcome from any item; items appear only as logged data (name, dose, timing, adherence)
- No em dashes or en dashes

Source file for each block is listed so edits can be made in one place.

---

## 1. Hero split visual
`app/clinics/sections/HeroSplitVisual.tsx`

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
`app/clinics/sections/BriefMockup.tsx`

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
`app/clinics/sections/Vignettes.tsx`

Decorative SVGs only, with no text (aria-hidden).
- Pregnancy: 270 thin ticks with 12 visit markers.
- Incident: a baseline with six irregular incident markers, each with a dashed "look-back" window before it.

---

## 4. Between visits alert mockup (section 8)
`app/clinics/sections/BetweenVisits.tsx`

- Label: "Alerts"
- Segmented control: "All activity" / "Safety only" (selected) / "None" (options are from the spec)
- Card: "Safety alert": "New patient-added item interacts with a current item. Flagged for your review."
- Card: "Your flag": "Ask about the logging gap. Surfaces at the top of the next brief."

COUNSEL NOTE: the safety alert example deliberately matches the spec's single alert trigger (patient adds something that interacts with what they already take). Review alongside section 8.

---

## 5. Founding-practice form (section 12)
`app/clinics/FoundingPracticeForm.tsx`, options in `app/clinics/options.ts`

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
`app/clinics/demo/page.tsx` (temporary; deleted once the real calendar link exists)

- Heading: "Book a demo"
- Body: "Demo scheduling opens here shortly. In the meantime, join the founding practices and we'll reach out to find a time."
- Button: "Join the founding practices"

---

## 7. Metadata
`app/clinics/page.tsx`
- Page title: "For Clinics - SuppVis"
- OG title: "SuppVis for Clinics"
- Description: "SuppVis builds the between-visit history from what your patient actually did, every day, and hands it to you as a pre-visit brief before they sit down." (adapted from the hero subhead)
- robots: noindex, nofollow (remove at publish)

## 8. Site footer
`app/components/Footer.tsx`
- New link "Clinics" under Product, next to Research
