import { CreateNFTForm } from "@/components/CreateNFTForm";

export default function CreatePage() {
  return (
    <main className="pageShell innerPage narrowPage premiumCreatePage">
      <div className="pageIntro premiumPageIntro">
        <span className="pageKicker">Create · ERC-721 · IPFS</span>
        <h1>Turn a work into<br />an on-chain record.</h1>
        <p>Publish the asset and metadata to IPFS, then mint the resulting <code>ipfs://</code> URI directly into the verified AegisMint ERC-721 collection on Sepolia.</p>
      </div>
      <CreateNFTForm />
    </main>
  );
}
