"use client";

import Navbar from "@/components/Navbar";
import TechnicalSignals from "@/components/TechnicalSignals";

export default function SignalsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 grid-bg">
        <div className="max-w-7xl mx-auto">
          <TechnicalSignals />
        </div>
      </main>
    </>
  );
}
