// app/admin/page.tsx
import {
  getCurrentEvent,
  listRegistrations,
  updateCurrentEvent,
  clearRegistrations,
} from "@/lib/db";
import { redirect } from "next/navigation";
import AdminToastClient from "@/components/AdminToastClient";

export const dynamic = "force-dynamic";

// Server action: update the current event
async function updateEventAction(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "");
  const location = String(formData.get("location") || "");
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const registrationFeeRaw = String(formData.get("registrationFee") || "");
  const description = String(formData.get("description") || "");

  const registrationFee = parseFloat(registrationFeeRaw || "0");

  await updateCurrentEvent({
    name,
    location,
    startDate,
    endDate,
    registrationFee: isNaN(registrationFee) ? 0 : registrationFee,
    description,
  });

  redirect("/admin?updated=1");
}

// Server action: clear all registrants
async function clearRegistrationsAction() {
  "use server";
  await clearRegistrations();
  redirect("/admin");
}

export default async function AdminPage() {
  const event = await getCurrentEvent();
  const regs = await listRegistrations();

  const startLocal = new Date(event.startDate).toISOString().slice(0, 16);
  const endLocal = new Date(event.endDate).toISOString().slice(0, 16);

  return (
    <div className="py-10">
      <AdminToastClient />
      <h1 className="mb-6 text-2xl font-bold text-white">Admin Portal</h1>

      {/* Event summary + edit form */}
      <section className="mb-8 rounded-2xl bg-white/95 p-6 shadow-2xl border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Current Event
        </h2>

        <form action={updateEventAction} className="space-y-4 text-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block font-medium text-gray-800">
                Event name
              </label>
              <input
                name="name"
                defaultValue={event.name}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-800">
                Location
              </label>
              <input
                name="location"
                defaultValue={event.location}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block font-medium text-gray-800">
                Start date/time
              </label>
              <input
                type="datetime-local"
                name="startDate"
                defaultValue={startLocal}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-800">
                End date/time
              </label>
              <input
                type="datetime-local"
                name="endDate"
                defaultValue={endLocal}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
            <div>
              <label className="block font-medium text-gray-800">
                Registration fee (USD)
              </label>
              <input
                type="number"
                step="0.01"
                name="registrationFee"
                defaultValue={event.registrationFee}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-800">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={event.description}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-gray-600">
              Total registrants: {regs.length}
            </p>
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700"
            >
              Save event changes
            </button>
          </div>
        </form>
      </section>

      {/* Registrants table + export + clear */}
      <section className="rounded-2xl bg-white/95 p-6 shadow-2xl border border-gray-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Registrants ({regs.length})
          </h2>

          <div className="flex flex-wrap gap-2">
            <a
              href="/api/admin/registrations/csv"
              className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-800 hover:bg-gray-100"
            >
              Export as CSV
            </a>

            <form action={clearRegistrationsAction}>
              <button
                type="submit"
                className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Clear all registrants
              </button>
            </form>
          </div>
        </div>

        {regs.length === 0 ? (
          <p className="mt-3 text-sm text-gray-700">No registrations yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-gray-900">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">DOB</th>
                  <th className="px-3 py-2 font-semibold">Age div</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Phone</th>
                  <th className="px-3 py-2 font-semibold">Duet/Trio</th>
                  <th className="px-3 py-2 font-semibold">Solo status</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {r.firstName} {r.lastName}
                    </td>
                    <td className="px-3 py-2">{r.dateOfBirth}</td>
                    <td className="px-3 py-2">{r.ageDivision}</td>
                    <td className="px-3 py-2">{r.email}</td>
                    <td className="px-3 py-2">{r.homePhone}</td>
                    <td className="px-3 py-2">
                      {r.isDuetOrTrio ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2">{r.soloStatus}</td>
                    <td className="px-3 py-2">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
