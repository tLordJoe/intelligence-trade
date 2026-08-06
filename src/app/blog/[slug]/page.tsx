"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getBlogPost, blogPosts } from "@/lib/blog-data";

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const post = getBlogPost(slug);

  if (!post) {
    return (
      <>
        <Navbar />
        <main className="flex-1 grid-bg flex items-center justify-center">
          <p style={{ color: "var(--text-dim)" }}>Post not found</p>
        </main>
      </>
    );
  }

  const currentIdx = blogPosts.findIndex((p) => p.slug === slug);
  const nextPost = blogPosts[currentIdx + 1];
  const prevPost = blogPosts[currentIdx - 1];

  return (
    <>
      <Navbar />
      <main className="flex-1 grid-bg">
        <article className="max-w-3xl mx-auto px-4 md:px-8 py-8">
          <div className="flex items-center gap-2 text-xs mb-6" style={{ color: "var(--text-dim)" }}>
            <span style={{ color: "var(--accent)" }}>$</span>
            <span>cat ./blog/{slug}.md</span>
          </div>

          <div className="flex items-center gap-2 mb-4">
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

          <h1 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: "var(--text)" }}>
            {post.title}
          </h1>

          <p className="text-sm mb-6 leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {post.excerpt}
          </p>

          <div className="flex flex-wrap gap-1 mb-8">
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

          <div
            className="rounded-lg border p-5 md:p-8 prose-terminal"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {post.content.split("\n\n").map((block, i) => {
              if (block.startsWith("### ")) {
                return (
                  <h3
                    key={i}
                    className="text-base font-bold mt-6 mb-2"
                    style={{ color: "var(--accent)" }}
                  >
                    {block.replace("### ", "")}
                  </h3>
                );
              }
              if (block.startsWith("## ")) {
                return (
                  <h2
                    key={i}
                    className="text-lg font-bold mt-8 mb-3"
                    style={{ color: "var(--text)" }}
                  >
                    {block.replace("## ", "")}
                  </h2>
                );
              }
              if (block.startsWith("- ") || block.startsWith("1. ")) {
                const items = block.split("\n").filter(Boolean);
                return (
                  <ul key={i} className="space-y-1 my-3 ml-4">
                    {items.map((item, j) => (
                      <li
                        key={j}
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--text)" }}
                      >
                        <span style={{ color: "var(--accent)" }}>→</span>{" "}
                        {item.replace(/^[-\d]+[.)]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1")}
                      </li>
                    ))}
                  </ul>
                );
              }
              return (
                <p
                  key={i}
                  className="text-sm leading-relaxed my-3"
                  style={{ color: "var(--text)" }}
                >
                  {block}
                </p>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: "var(--border)" }}>
            {prevPost ? (
              <Link
                href={`/blog/${prevPost.slug}`}
                className="text-xs hover:underline"
                style={{ color: "var(--accent)" }}
              >
                ← {prevPost.title.slice(0, 40)}...
              </Link>
            ) : <span />}
            {nextPost ? (
              <Link
                href={`/blog/${nextPost.slug}`}
                className="text-xs hover:underline"
                style={{ color: "var(--accent)" }}
              >
                {nextPost.title.slice(0, 40)}... →
              </Link>
            ) : <span />}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/blog"
              className="text-xs hover:underline"
              style={{ color: "var(--text-dim)" }}
            >
              ← Back to all posts
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}
