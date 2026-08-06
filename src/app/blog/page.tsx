"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import { blogPosts } from "@/lib/blog-data";

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 grid-bg">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-dim)" }}>
            <span style={{ color: "var(--accent)" }}>$</span>
            <span>ls ./blog --latest</span>
          </div>

          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text)" }}>
            <span style={{ color: "var(--accent)" }}>Intelligence</span> Blog
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--text-dim)" }}>
            Analysis, research, and insights on the AI supply chain
          </p>

          <div className="space-y-4">
            {blogPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block rounded-lg border p-5 transition-all hover:border-[var(--accent)] hover:scale-[1.01]"
                style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded uppercase"
                    style={{ backgroundColor: "var(--accent)", color: "#fff" }}
                  >
                    {post.category}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>{post.date}</span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>·</span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>{post.readTime}</span>
                </div>

                <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>
                  {post.title}
                </h2>

                <p className="text-sm mb-3" style={{ color: "var(--text-dim)" }}>
                  {post.excerpt}
                </p>

                <div className="flex flex-wrap gap-1">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded border"
                      style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
