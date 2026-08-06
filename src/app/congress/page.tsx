"use client";

import Navbar from "@/components/Navbar";
import CongressTrades from "@/components/CongressTrades";

export default function CongressPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 grid-bg">
        <div className="max-w-7xl mx-auto">
          <CongressTrades />
        </div>
      </main>
    </>
  );
}
