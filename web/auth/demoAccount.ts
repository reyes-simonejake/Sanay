// A ready-made account for looking around the account pages in the browser preview.
// Only used while the in-browser demo backend is active (never with a real backend).
import type { ProfilePatch } from "./backend";

export const DEMO_ACCOUNT = {
  email: "demo@sanay.test",
  password: "SanayDemo-2026",
  name: "Juan Dela Cruz",
  profile: {
    country: "PH",
    language: "en",
    useCase: "interviews",
    defaultVoice: "feminine",
  } satisfies ProfilePatch,
};
