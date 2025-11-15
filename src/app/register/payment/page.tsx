// app/register/payment/page.tsx
import Link from "next/link";

export default function PaymentPage() {
  return (
    <div className="flex h-full items-start sm:items-center justify-center px-4 py-4 sm:py-6">
      <div className="w-full max-w-md rounded-xl bg-white p-4 sm:p-8 shadow-2xl border border-gray-300">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
          Payment (Test Mode)
        </h1>

        <p className="text-xs sm:text-sm text-gray-700 mb-6">
          <strong>Note:</strong> This page is a placeholder. In production, this
          step will redirect to an external payment provider (Stripe, Square,
          PayPal, etc.). No real payments are processed here.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Card Number
            </label>
            <input
              type="text"
              placeholder="4242 4242 4242 4242"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Expiration
              </label>
              <input
                type="text"
                placeholder="MM/YY"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                CVC
              </label>
              <input
                type="text"
                placeholder="123"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
              />
            </div>
          </div>
        </div>

        <Link
          href="/thank-you"
          className="mt-6 block rounded-lg bg-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-violet-700"
        >
          Submit
        </Link>
      </div>
    </div>
  );
}
