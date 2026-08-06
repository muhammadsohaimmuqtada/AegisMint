import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("AegisMintModule", (m) => {
  const initialOwner = m.getAccount(0);
  const marketplaceFeeBps = m.getParameter("marketplaceFeeBps", 250);

  const nft = m.contract("AegisNFT");
  const marketplace = m.contract("AegisMarketplace", [initialOwner, nft, marketplaceFeeBps]);

  return { nft, marketplace };
});
