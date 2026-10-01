// Demo account with sample meetings, created on demand from the login page.
import { DEFAULT_HOURS } from "./scheduling";
import { addDays } from "./format";
import {
  getUserByEmail,
  hashPassword,
  insertSeed,
  startSession,
  type Meeting,
  type User,
} from "./store";

export const DEMO_EMAIL = "demo@meethub.test";
export const DEMO_PASSWORD = "demo-meethub";

function at(dayOffset: number, hour: number, minute = 0) {
  const d = addDays(new Date(), dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export async function logInAsDemo() {
  const existing = getUserByEmail(DEMO_EMAIL);
  if (existing) {
    startSession(existing.id);
    return;
  }

  const salt = crypto.randomUUID();
  const user: User = {
    id: crypto.randomUUID(),
    name: "Ada Demo",
    email: DEMO_EMAIL,
    username: "ada-demo",
    salt,
    passwordHash: await hashPassword(DEMO_PASSWORD, salt),
    createdAt: new Date().toISOString(),
    availability: DEFAULT_HOURS.map((d) => ({ ...d })),
    meetingLength: 30,
    bookingTitle: "Product walkthrough",
    bookingMessage: "Grab 30 minutes and I'll show you around MeetHub.",
  };

  // Next whole hour from now, so "today" always has something upcoming
  const soon = new Date();
  soon.setHours(soon.getHours() + 2, 0, 0, 0);

  const base = { hostId: user.id, status: "scheduled" as const, createdAt: new Date().toISOString() };
  const meetings: Meeting[] = [
    {
      ...base,
      id: crypto.randomUUID(),
      title: "Design review",
      description: "Walk through the new onboarding screens.",
      start: soon.toISOString(),
      duration: 45,
      invitees: ["kemi@studio.test", "tobi@studio.test"],
      source: "manual",
    },
    {
      ...base,
      id: crypto.randomUUID(),
      title: "Weekly team sync",
      description: "Priorities, blockers, and wins.",
      start: at(1, 10),
      duration: 30,
      invitees: ["team@studio.test"],
      source: "manual",
    },
    {
      ...base,
      id: crypto.randomUUID(),
      title: "Product walkthrough",
      description: "",
      start: at(1, 14, 30),
      duration: 30,
      invitees: ["marcus@client.test"],
      source: "booking",
      guest: { name: "Marcus Webb", email: "marcus@client.test", note: "Keen to see the whiteboard." },
    },
    {
      ...base,
      id: crypto.randomUUID(),
      title: "Quarterly planning",
      description: "Roadmap for next quarter.",
      start: at(3, 11),
      duration: 90,
      invitees: ["leads@studio.test"],
      source: "manual",
    },
    {
      ...base,
      id: crypto.randomUUID(),
      title: "Client kickoff",
      description: "",
      start: at(-1, 15),
      duration: 60,
      invitees: ["aisha@client.test"],
      source: "manual",
    },
  ];

  insertSeed([user], meetings);
  startSession(user.id);
}
