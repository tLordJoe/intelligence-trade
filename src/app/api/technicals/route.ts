import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Technical indicators are unavailable while the methodology is being validated.",
    },
    { status: 503 }
  );
}
