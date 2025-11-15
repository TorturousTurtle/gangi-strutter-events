// components/Footer.tsx
export default function Footer() {
  return (
    <footer className="mt-8 border-t border-gray-300/40 bg-[#4a4a4a] py-4">
      <div className="mx-auto w-full max-w-5xl px-4 text-center text-sm text-gray-200">
        <p className="font-semibold text-gray-100">Gangi Bay State Strutters</p>
        <p className="text-gray-300 mt-1">
          Event Registration Portal © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
