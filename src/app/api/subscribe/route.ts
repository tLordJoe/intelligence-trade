import { NextRequest, NextResponse } from "next/server";

/*
  Newsletter signup, backed by Buttondown.

  Requires BUTTONDOWN_API_KEY in the environment. Without it the route reports
  that signups are unavailable rather than accepting an address it cannot
  store — losing a subscriber silently is worse than saying signups are closed.
*/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function GET() {
  return NextResponse.json({ enabled: Boolean(process.env.BUTTONDOWN_API_KEY) });
}

export async function POST(req: NextRequest) {
  const key = process.env.BUTTONDOWN_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "Signups aren't open yet. Please check back shortly." },
      { status: 503 }
    );
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "That doesn't look like a valid email address." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch("https://api.buttondown.email/v1/subscribers", {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email_address: email, tags: ["outfox-report"] }),
    });

    // Already subscribed is a success from the visitor's point of view.
    if (res.status === 400) {
      const detail = await res.text();
      if (detail.toLowerCase().includes("already")) {
        return NextResponse.json({ ok: true, alreadySubscribed: true });
      }
      return NextResponse.json(
        { error: "We couldn't add that address. Try a different one?" },
        { status: 400 }
      );
    }

    if (!res.ok) throw new Error(`buttondown ${res.status}`);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 502 }
    );
  }
}
