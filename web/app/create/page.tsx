import { CreateNFTForm } from "@/components/CreateNFTForm";

export default function CreatePage() {
  return (
    <main className="pageShell innerPage narrowPage">
      <div className="pageIntro"><span className="eyebrow">Create / Mint</span><h1>Publish a verifiable NFT.</h1><p>Your asset is pinned to IPFS first, then its metadata JSON is pinned separately. Only the resulting <code>ipfs://</code> metadata URI is committed to the ERC-721 token.</p></div>
      <CreateNFTForm />
    </main>
  );
}
