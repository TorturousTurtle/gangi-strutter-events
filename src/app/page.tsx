// app/page.tsx
import Link from "next/link";
import { getCurrentEvent } from "@/lib/db";

export default async function HomePage() {
  const event = await getCurrentEvent();

  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          Upcoming Baton Event
        </h2>
        <p className="mt-2 text-sm sm:text-base text-gray-200">
          There is currently one active event. Register below.
        </p>
      </section>

      <section className="rounded-2xl bg-white/95 p-4 sm:p-8 shadow-2xl border border-gray-200">
        <div className="space-y-4">
          <div>
            <h3 className="text-xl sm:text-2xl font-semibold text-gray-900">
              {event.name}
            </h3>
            <p className="mt-2 text-sm sm:text-base text-gray-700">
              {event.description}
            </p>
          </div>

          <dl className="grid gap-3 text-sm sm:text-base">
            <div className="grid grid-cols-[90px,1fr] gap-2">
              <dt className="font-medium text-gray-600">Location</dt>
              <dd className="text-gray-900">{event.location}</dd>
            </div>
            <div className="grid grid-cols-[90px,1fr] gap-2">
              <dt className="font-medium text-gray-600">Date</dt>
              <dd className="text-gray-900">
                {start.toLocaleString()} – {end.toLocaleString()}
              </dd>
            </div>
            <div className="grid grid-cols-[90px,1fr] gap-2">
              <dt className="font-medium text-gray-600">Registration</dt>
              <dd className="text-gray-900">
                ${event.registrationFee.toFixed(2)}
              </dd>
            </div>
          </dl>

          <div className="pt-2">
            <Link
              href="/register"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Register now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
