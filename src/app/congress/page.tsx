"use client";

import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import CongressTrades from "@/components/CongressTrades";
import NewsletterSignup from "@/components/NewsletterSignup";

export default function CongressPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto">
          <CongressTrades />
        <NewsletterSignup />
        </div>
      </main>
    <SiteFooter />
    </>
  );
}
