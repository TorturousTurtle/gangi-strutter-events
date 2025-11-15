// app/api/admin/registrations/csv/route.ts
import { NextResponse } from "next/server";
import { listRegistrations } from "@/lib/db";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Escape " by doubling it, wrap in quotes to handle commas/newlines
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET() {
  const regs = await listRegistrations();

  const headers = [
    "First Name",
    "Last Name",
    "Date of Birth",
    "Gender",
    "Age Division",
    "Coach Names",
    "Is Duet/Trio",
    "Duet Age Division",
    "Trio Age Division",
    "Partner Name",
    "Address",
    "Home Phone",
    "Email",
    "Solo Status",
    "First Place Wins",
    "Solo Status As Of",
    "Beginner Title Info",
    "Intermediate Title Info",
    "Booster Ad Text",
    "Created At",
  ];

  const rows = regs.map((r) => [
    r.firstName,
    r.lastName,
    r.dateOfBirth,
    r.gender,
    r.ageDivision,
    r.coachNames,
    r.isDuetOrTrio ? "Yes" : "No",
    r.duetAgeDivision,
    r.trioAgeDivision,
    r.partnerName,
    r.address,
    r.homePhone,
    r.email,
    r.soloStatus,
    r.soloFirstPlaceWins,
    r.soloStatusAsOfDate,
    r.beginnerTitleInfo,
    r.intermediateTitleInfo,
    r.boosterAdText,
    r.createdAt,
  ]);

  const csv =
    headers.map(escapeCsv).join(",") +
    "\n" +
    rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="registrations.csv"',
    },
  });
}
