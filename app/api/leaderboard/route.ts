import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await db.player.findMany({
      orderBy: [{ wins: "desc" }, { kills: "desc" }],
      take: 10,
    });
    return NextResponse.json({ players });
  } catch (e) {
    console.error("leaderboard GET error:", e);
    return NextResponse.json({ players: [] }, { status: 500 });
  }
}
