import { NextResponse } from "next/server";
import { getServerPinata } from "@/lib/pinata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function cleanName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "nft-asset";
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; size?: unknown };
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "File name is required" }, { status: 400 });
    }
    if (typeof body.size !== "number" || !Number.isSafeInteger(body.size) || body.size <= 0) {
      return NextResponse.json({ error: "File size is invalid" }, { status: 400 });
    }
    if (body.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds the 20 MB upload limit" }, { status: 413 });
    }

    const url = await getServerPinata().upload.public.createSignedURL({
      expires: 60,
      maxFileSize: MAX_FILE_BYTES,
      name: `aegismint-${Date.now()}-${cleanName(body.name)}`,
    });

    return NextResponse.json({ url, maxFileSize: MAX_FILE_BYTES });
  } catch (error) {
    console.error("Pinata signed URL creation failed", error);
    return NextResponse.json({ error: "Unable to authorize IPFS upload" }, { status: 500 });
  }
}
