import { NextRequest, NextResponse } from "next/server";
import { addRegistration, getCurrentEvent } from "@/lib/db";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const event = await getCurrentEvent();

  const registration = {
    id: randomUUID(),
    eventId: event.id,
    firstName: String(formData.get("firstName") || ""),
    lastName: String(formData.get("lastName") || ""),
    dateOfBirth: String(formData.get("dateOfBirth") || ""),
    gender: String(formData.get("gender") || ""),
    coachNames: String(formData.get("coachNames") || ""),
    ageDivision: String(formData.get("ageDivision") || ""),
    isDuetOrTrio: String(formData.get("isDuetOrTrio") || "no") === "yes",
    duetAgeDivision: String(formData.get("duetAgeDivision") || ""),
    trioAgeDivision: String(formData.get("trioAgeDivision") || ""),
    partnerName: String(formData.get("partnerName") || ""),
    address: String(formData.get("address") || ""),
    homePhone: String(formData.get("homePhone") || ""),
    email: String(formData.get("email") || ""),
    soloStatus: String(formData.get("soloStatus") || ""),
    soloFirstPlaceWins: String(formData.get("soloFirstPlaceWins") || ""),
    soloStatusAsOfDate: String(formData.get("soloStatusAsOfDate") || ""),
    beginnerTitleInfo: String(formData.get("beginnerTitleInfo") || ""),
    intermediateTitleInfo: String(
      formData.get("intermediateTitleInfo") || ""
    ),
    boosterAdText: String(formData.get("boosterAdText") || ""),
    agreement: formData.get("agreement") === "on",
    createdAt: new Date().toISOString(),
  };

  if (!registration.firstName || !registration.lastName || !registration.email) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  await addRegistration(registration);

  return NextResponse.json({ ok: true });
}
