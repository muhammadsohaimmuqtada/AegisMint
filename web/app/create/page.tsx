import { CreateNFTForm } from "@/components/CreateNFTForm";

export default function CreatePage() {
  return (
    <main className="pageShell innerPage narrowPage">
      <div className="pageIntro">
        <span className="pageKicker">Create / ERC-721</span>
        <h1>Mint a work.</h1>
        <p>Upload the asset, publish its metadata to IPFS, then commit the resulting <code>ipfs://</code> URI to the AegisMint ERC-721 contract.</p>
      </div>
      <CreateNFTForm />
    </main>
  );
}
