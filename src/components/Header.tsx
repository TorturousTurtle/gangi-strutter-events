"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-violet-700 text-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo / Title */}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-wide">
          Gangi Bay State Strutters Events
        </h1>

        {/* Desktop nav */}
        <nav className="hidden sm:flex gap-6 text-sm">
          <Link href="/" className="hover:text-gray-200">
            Home
          </Link>
          <Link href="/admin" className="hover:text-gray-200">
            Admin
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          className="sm:hidden p-2 rounded-md hover:bg-violet-600"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <nav className="sm:hidden bg-violet-800 border-t border-violet-600 px-4 py-3 space-y-3 text-sm">
          <Link
            href="/"
            className="block hover:text-gray-200"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/admin"
            className="block hover:text-gray-200"
            onClick={() => setOpen(false)}
          >
            Admin
          </Link>
        </nav>
      )}
    </header>
  );
}
