// app/register/page.tsx
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/register", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      setSubmitting(false);
      setError("Something went wrong. Please try again.");
      return;
    }

    router.push("/register/payment");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-white">
        Event Registration
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl bg-white/95 p-4 sm:p-8 shadow-2xl border border-gray-200"
      >
        {/* Basic info */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-800">
              First name
            </label>
            <input
              name="firstName"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Last name
            </label>
            <input
              name="lastName"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Date of birth
            </label>
            <input
              name="dateOfBirth"
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Gender
            </label>
            <select
              name="gender"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select…
              </option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Age division
            </label>
            <input
              name="ageDivision"
              placeholder="e.g. 10–12"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800">
            All coaches&apos; names
          </label>
          <input
            name="coachNames"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        {/* Duet / trio */}
        <fieldset className="space-y-3 rounded-xl border border-gray-300 bg-gray-50 p-4">
          <legend className="text-sm font-medium text-gray-900">
            Are you registering a DUET and/or TRIO?
          </legend>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-900">
              <input type="radio" name="isDuetOrTrio" value="yes" />
              <span>Yes</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name="isDuetOrTrio"
                value="no"
                defaultChecked
              />
              <span>No</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Duet age division
              </label>
              <input
                name="duetAgeDivision"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-800">
                Trio age division
              </label>
              <input
                name="trioAgeDivision"
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-800">
              Partner&apos;s name
            </label>
            <input
              name="partnerName"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </fieldset>

        {/* Contact info */}
        <div>
          <label className="block text-sm font-medium text-gray-800">
            Address
          </label>
          <textarea
            name="address"
            rows={2}
            required
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Home phone number
            </label>
            <input
              name="homePhone"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Email address
            </label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>

        {/* Solo status */}
        <div>
          <label className="block text-sm font-medium text-gray-800">
            My solo status is…
          </label>
          <input
            name="soloStatus"
            placeholder="Beginner / Intermediate / Advanced"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-800">
              First place wins at this level
            </label>
            <input
              name="soloFirstPlaceWins"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-800">
              Solo status updated as of
            </label>
            <input
              name="soloStatusAsOfDate"
              type="date"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>

        {/* Titles */}
        <div>
          <label className="block text-sm font-medium text-gray-800">
            Miss Majorette/Pageant State or Regional title in Beginner? When?
          </label>
          <textarea
            name="beginnerTitleInfo"
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800">
            Miss Majorette/Pageant State or Regional title in Intermediate?
            When?
          </label>
          <textarea
            name="intermediateTitleInfo"
            rows={2}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        {/* Booster ad */}
        <div>
          <label className="block text-sm font-medium text-gray-800">
            Booster ad text (if purchasing a Booster Ad)
          </label>
          <textarea
            name="boosterAdText"
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </div>

        {/* Agreement */}
        <div className="space-y-2 text-sm text-gray-900">
          <p>
            By submitting this form, Contestant/Coach/Parent agrees to the
            publicity rules described on the registration page.
          </p>
          <label className="inline-flex items-center gap-2">
            <input name="agreement" type="checkbox" required />
            <span>I agree.</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg px-5 py-2 text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Proceed to payment"}
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Payment will be completed on the next step once a provider is added.
        </p>
      </form>
    </div>
  );
}
