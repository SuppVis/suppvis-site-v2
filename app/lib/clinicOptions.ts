// Shared by the client form and the server zod schema so they cannot drift.
export const CLINIC_PRACTICE_TYPES = [
  "Naturopathic",
  "Integrative or functional medicine",
  "Nurse practitioner practice",
  "Multi-provider practice",
  "Other",
] as const;

export const CLINIC_DISPENSING_OPTIONS = [
  "Fullscript",
  "Wellevate",
  "Other",
  "We don't currently dispense",
] as const;
