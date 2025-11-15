// app/layout.tsx
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Gangi Bay State Strutters Events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#5c5c5c] text-gray-900 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 w-full px-4 py-6 sm:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <Footer />
      </body>
    </html>
  );
}
