"use client";

import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import CongressTrades from "@/components/CongressTrades";

export default function CongressPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto">
          <CongressTrades />
        </div>
      </main>
    <SiteFooter />
    </>
  );
}
