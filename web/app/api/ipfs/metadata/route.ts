import { NextResponse } from "next/server";
import { getServerPinata } from "@/lib/pinata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTRIBUTES = 20;
const MAX_REQUEST_BYTES = 16 * 1024;
const IPFS_URI = /^ipfs:\/\/[A-Za-z0-9]+$/;

type MetadataInput = {
  name?: unknown;
  description?: unknown;
  image?: unknown;
  attributes?: unknown;
  creator?: unknown;
};

type Attribute = { trait_type: string; value: string };

function normalizeAttributes(value: unknown): Attribute[] | null {
  if (!Array.isArray(value) || value.length > MAX_ATTRIBUTES) return null;
  const normalized: Attribute[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const trait = (entry as Record<string, unknown>).trait_type;
    const itemValue = (entry as Record<string, unknown>).value;
    if (typeof trait !== "string" || typeof itemValue !== "string") return null;
    const cleanTrait = trait.trim();
    const cleanValue = itemValue.trim();
    if (!cleanTrait || !cleanValue || cleanTrait.length > 80 || cleanValue.length > 160) return null;
    normalized.push({ trait_type: cleanTrait, value: cleanValue });
  }
  return normalized;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Metadata request is too large" }, { status: 413 });
    }

    const body = await request.json() as MetadataInput;
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 80) {
      return NextResponse.json({ error: "Metadata name must be 1–80 characters" }, { status: 400 });
    }
    if (typeof body.description !== "string" || !body.description.trim() || body.description.trim().length > 1000) {
      return NextResponse.json({ error: "Description must be 1–1000 characters" }, { status: 400 });
    }
    if (typeof body.image !== "string" || !IPFS_URI.test(body.image)) {
      return NextResponse.json({ error: "Image must be a direct ipfs://CID URI" }, { status: 400 });
    }
    if (typeof body.creator !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(body.creator)) {
      return NextResponse.json({ error: "Creator address is invalid" }, { status: 400 });
    }

    const attributes = normalizeAttributes(body.attributes);
    if (attributes === null) {
      return NextResponse.json({ error: `Attributes must contain at most ${MAX_ATTRIBUTES} valid string pairs` }, { status: 400 });
    }

    const metadata = {
      name: body.name.trim(),
      description: body.description.trim(),
      image: body.image,
      attributes,
      creator: body.creator,
    };

    const upload = await getServerPinata().upload.public
      .json(metadata)
      .name(`aegismint-metadata-${Date.now()}.json`);

    return NextResponse.json({ cid: upload.cid, uri: `ipfs://${upload.cid}` });
  } catch (error) {
    console.error("Pinata metadata upload failed", error);
    return NextResponse.json({ error: "Unable to upload metadata to IPFS" }, { status: 500 });
  }
}
