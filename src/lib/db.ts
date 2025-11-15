// lib/db.ts
import fs from "fs/promises";
import path from "path";

export type Event = {
  id: string;
  name: string;
  location: string;
  startDate: string;
  endDate: string;
  registrationFee: number;
  description: string;
};

export type Registration = {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  coachNames: string;
  ageDivision: string;
  isDuetOrTrio: boolean;
  duetAgeDivision?: string;
  trioAgeDivision?: string;
  partnerName?: string;
  address: string;
  homePhone?: string;
  email: string;
  soloStatus?: string;
  soloFirstPlaceWins?: string;
  soloStatusAsOfDate?: string;
  beginnerTitleInfo?: string;
  intermediateTitleInfo?: string;
  boosterAdText?: string;
  agreement: boolean;
  createdAt: string;
};

type DbShape = {
  event: Event;
  registrations: Registration[];
};

const DATA_FILE = path.join(process.cwd(), "data.json");

// ------------------------
// Default seed data
// ------------------------

const defaultEvent: Event = {
  id: "1",
  name: "Northeast Baton Classic",
  location: "Hopewell Junction High School, NY",
  startDate: "2025-06-20T09:00:00Z",
  endDate: "2025-06-20T17:00:00Z",
  registrationFee: 85,
  description:
    "One-day baton competition with solo, duet, and trio events for ages 5-18.",
};

const defaultRegistrations: Registration[] = [
  {
    id: "reg-001",
    eventId: "1",
    firstName: "Ava",
    lastName: "Martinez",
    dateOfBirth: "2013-04-12",
    gender: "Female",
    coachNames: "Sarah Gomez",
    ageDivision: "10–12",
    isDuetOrTrio: false,
    duetAgeDivision: "",
    trioAgeDivision: "",
    partnerName: "",
    address: "15 Willow Ridge Dr, Poughkeepsie, NY",
    homePhone: "845-555-2114",
    email: "ava.martinez@example.com",
    soloStatus: "Beginner",
    soloFirstPlaceWins: "2",
    soloStatusAsOfDate: "2025-01-10",
    beginnerTitleInfo: "N/A",
    intermediateTitleInfo: "",
    boosterAdText: "",
    agreement: true,
    createdAt: "2025-11-01T14:22:00Z",
  },
  {
    id: "reg-002",
    eventId: "1",
    firstName: "Lily",
    lastName: "Chen",
    dateOfBirth: "2011-09-05",
    gender: "Female",
    coachNames: "Amanda Lee, Grace Kingston",
    ageDivision: "13–15",
    isDuetOrTrio: true,
    duetAgeDivision: "13–15",
    trioAgeDivision: "",
    partnerName: "Emma Patel",
    address: "92 Brookside Ave, Hopewell Junction, NY",
    homePhone: "845-555-8892",
    email: "lily.chen@example.com",
    soloStatus: "Intermediate",
    soloFirstPlaceWins: "1",
    soloStatusAsOfDate: "2025-02-14",
    beginnerTitleInfo: "",
    intermediateTitleInfo:
      "2024 Intermediate Miss Majorette State Title – CT",
    boosterAdText: "",
    agreement: true,
    createdAt: "2025-11-02T10:44:00Z",
  },
  {
    id: "reg-003",
    eventId: "1",
    firstName: "Sophia",
    lastName: "Reynolds",
    dateOfBirth: "2015-01-21",
    gender: "Female",
    coachNames: "Carly Jenkins",
    ageDivision: "7–9",
    isDuetOrTrio: false,
    duetAgeDivision: "",
    trioAgeDivision: "",
    partnerName: "",
    address: "301 Oak Hollow Rd, Fishkill, NY",
    homePhone: "",
    email: "s.reynolds@example.com",
    soloStatus: "Beginner",
    soloFirstPlaceWins: "0",
    soloStatusAsOfDate: "2025-03-01",
    beginnerTitleInfo: "",
    intermediateTitleInfo: "",
    boosterAdText: "Good luck Sophia!",
    agreement: true,
    createdAt: "2025-11-02T16:12:00Z",
  },
  {
    id: "reg-004",
    eventId: "1",
    firstName: "Maya",
    lastName: "Patel",
    dateOfBirth: "2010-11-03",
    gender: "Female",
    coachNames: "Naomi Brooks",
    ageDivision: "13–15",
    isDuetOrTrio: true,
    duetAgeDivision: "",
    trioAgeDivision: "13–15",
    partnerName: "Lily Chen, Ella Grant",
    address: "77 Pine Terrace, Wappingers Falls, NY",
    homePhone: "845-555-1029",
    email: "maya.patel@example.com",
    soloStatus: "Advanced",
    soloFirstPlaceWins: "5",
    soloStatusAsOfDate: "2025-02-01",
    beginnerTitleInfo: "",
    intermediateTitleInfo: "",
    boosterAdText: "",
    agreement: true,
    createdAt: "2025-11-03T09:55:00Z",
  },
  {
    id: "reg-005",
    eventId: "1",
    firstName: "Ella",
    lastName: "Grant",
    dateOfBirth: "2010-06-29",
    gender: "Female",
    coachNames: "Naomi Brooks",
    ageDivision: "13–15",
    isDuetOrTrio: true,
    duetAgeDivision: "",
    trioAgeDivision: "13–15",
    partnerName: "Maya Patel, Lily Chen",
    address: "4 Windmill Rd, Hyde Park, NY",
    homePhone: "",
    email: "ella.grant@example.com",
    soloStatus: "Intermediate",
    soloFirstPlaceWins: "3",
    soloStatusAsOfDate: "2025-02-10",
    beginnerTitleInfo: "",
    intermediateTitleInfo: "",
    boosterAdText: "We are so proud of you Ella!",
    agreement: true,
    createdAt: "2025-11-03T11:18:00Z",
  },
];

const defaultDb: DbShape = {
  event: defaultEvent,
  registrations: defaultRegistrations,
};

// ------------------------
// Internal helpers
// ------------------------

async function readDb(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as DbShape;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      // First run – seed with defaults
      await writeDb(defaultDb);
      return defaultDb;
    }
    throw err;
  }
}

async function writeDb(db: DbShape): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

// ------------------------
// Public API
// ------------------------

export async function getCurrentEvent(): Promise<Event> {
  const db = await readDb();
  return db.event;
}

export async function listRegistrations(): Promise<Registration[]> {
  const db = await readDb();
  return db.registrations;
}

export async function updateCurrentEvent(
  partial: Partial<Event>
): Promise<void> {
  const db = await readDb();
  db.event = { ...db.event, ...partial };
  await writeDb(db);
}

export async function clearRegistrations(): Promise<void> {
  const db = await readDb();
  db.registrations = [];
  await writeDb(db);
}

export async function addRegistration(reg: Registration): Promise<void> {
  const db = await readDb();
  db.registrations.push(reg);
  await writeDb(db);
}
