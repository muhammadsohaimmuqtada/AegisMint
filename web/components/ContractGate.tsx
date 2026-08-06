import { contractsConfigured } from "@/lib/contracts";

export function ContractGate({ children }: { children: React.ReactNode }) {
  if (contractsConfigured) return children;

  return (
    <div className="emptyState">
      <span className="eyebrow">Deployment required</span>
      <h3>Contracts are not configured yet</h3>
      <p>Deploy AegisNFT and AegisMarketplace, then add their Sepolia addresses to the frontend environment.</p>
    </div>
  );
}
