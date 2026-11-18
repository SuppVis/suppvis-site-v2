// Site-wide destinations shared by the nav, the homepage, /portal and /about.

// Destination for every "Book a demo" button on the site.
// Publish gate 4: replace this placeholder route with the real calendar link
// (for example a Calendly or Cal.com URL) before the site receives traffic.
export const BOOK_DEMO_HREF = "/demo";

// Anchor for the founding-practice waitlist form on the homepage. Deliberately
// not "#waitlist", which is the patient beta signup on /patients.
export const FOUNDING_FORM_ID = "founding-practices";
export const FOUNDING_FORM_HREF = `/#${FOUNDING_FORM_ID}`;

// Patient beta signup. "Get Early Access" lives on /patients only.
export const PATIENT_WAITLIST_ID = "waitlist";
export const PATIENT_WAITLIST_HREF = `/patients#${PATIENT_WAITLIST_ID}`;
