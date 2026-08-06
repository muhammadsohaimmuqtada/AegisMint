import { NFTDetailClient } from "@/components/NFTDetailClient";

export default async function NFTDetailPage({ params }: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await params;
  let parsed: bigint;
  try {
    parsed = BigInt(tokenId);
  } catch {
    parsed = 0n;
  }

  return (
    <main className="pageShell detailPage">
      <NFTDetailClient tokenId={parsed} />
    </main>
  );
}
