import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** One branded card for both Open Graph and Twitter; no remote asset dependency. */
export async function renderShareImage() {
  const [font, logo] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Inter-ExtraBold.ttf")),
    readFile(join(process.cwd(), "public/brand/outfox-tail.svg")),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f7f4ef", color: "#0b1f44", padding: "58px 70px", fontFamily: "Inter", fontWeight: 800 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, paddingBottom: 30, borderBottom: "2px solid #dedbd4" }}>
          {/* The original logo is embedded unchanged, rather than redrawn. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/svg+xml;base64,${logo.toString("base64")}`} width={108} height={92} alt="" />
          <div style={{ display: "flex", fontSize: 96, letterSpacing: "-5px" }}>outfox</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 48, fontSize: 66, lineHeight: 1.12, letterSpacing: "-2.5px" }}>
          <div style={{ display: "flex" }}>Trade smarter than</div>
          <div style={{ display: "flex", color: "#0e9f6e" }}>the people in charge.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", marginTop: "auto", gap: 14, fontSize: 25, letterSpacing: "-0.5px" }}>
          <div style={{ display: "flex", background: "#f26a16", width: 32, height: 5 }} />
          outfoxmarkets.com
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts: [{ name: "Inter", data: font, style: "normal", weight: 800 }] },
  );
}
