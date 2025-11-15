// app/thank-you/page.tsx
import Link from "next/link";

export default function ThankYouPage() {
  return (
    <div className="flex h-full items-start sm:items-center justify-center px-4 py-8 sm:py-16">
      <div className="w-full max-w-xl rounded-2xl bg-white/95 p-4 sm:p-8 shadow-2xl border border-gray-200 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Registration Received
        </h1>

        <p className="mt-4 text-sm sm:text-base text-gray-700">
          Thank you for registering for this event. Your information has been
          recorded successfully.
        </p>

        <p className="mt-2 text-sm sm:text-base text-gray-700">
          If payment is required, you will receive instructions shortly or be
          redirected once online payments are enabled.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link
            href="/"
            className="w-full sm:w-auto inline-block rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white text-center hover:bg-violet-700"
          >
            Back to Event Page
          </Link>

          <Link
            href="/register"
            className="w-full sm:w-auto inline-block rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-800 text-center hover:bg-gray-100"
          >
            Register Another Athlete
          </Link>
        </div>
      </div>
    </div>
  );
}
