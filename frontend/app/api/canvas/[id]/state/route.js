import { NextResponse } from "next/server";
import { getCanvasState, setCanvasState, toResponse } from "@/app/lib/state";

export async function GET(_req, { params }) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing canvas id" }, { status: 400 });
  }
  const state = getCanvasState(id);
  return NextResponse.json(toResponse(state), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req, { params }) {
  const id = params?.id;
  if (!id) {
    return NextResponse.json({ error: "Missing canvas id" }, { status: 400 });
  }
  let body;
  try {
    body = await req.json();
  } catch (_e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const next = {};
  if (typeof body.lookedAt === "boolean") next.lookedAt = body.lookedAt;

  const updated = setCanvasState(id, next);
  return NextResponse.json(toResponse(updated), { status: 200 });
}
