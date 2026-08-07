"use client";

import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import TechnicalSignals from "@/components/TechnicalSignals";

export default function SignalsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto">
          <TechnicalSignals />
        </div>
      </main>
    <SiteFooter />
    </>
  );
}
