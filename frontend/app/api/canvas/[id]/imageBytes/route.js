import { NextResponse } from "next/server";
import {
  getImageBytes,
  setImageBytes,
  deleteImageBytes,
} from "@/app/lib/imageBytesStore";

export async function GET(_req, { params }) {
  const id = params?.id;
  if (!id)
    return NextResponse.json({ error: "Missing canvas id" }, { status: 400 });
  const bytes = getImageBytes(id);
  if (!bytes) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      "Content-Length": String(bytes.byteLength),
    },
  });
}

export async function POST(req, { params }) {
  const id = params?.id;
  if (!id)
    return NextResponse.json({ error: "Missing canvas id" }, { status: 400 });
  const buf = await req.arrayBuffer();
  const bytes = new Uint8Array(buf);
  setImageBytes(id, bytes);
  return NextResponse.json(
    { ok: true, size: bytes.byteLength },
    { status: 200 }
  );
}

export async function DELETE(_req, { params }) {
  const id = params?.id;
  if (!id)
    return NextResponse.json({ error: "Missing canvas id" }, { status: 400 });
  deleteImageBytes(id);
  return NextResponse.json({ ok: true }, { status: 200 });
}
