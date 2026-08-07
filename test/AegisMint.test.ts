import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

const URI_ONE = "ipfs://bafybeigdyrzt5-example-metadata-1";
const URI_TWO = "ipfs://bafybeigdyrzt5-example-metadata-2";
const PRICE = ethers.parseEther("0.1");
const FEE_BPS = 250n;

async function deploySystem() {
  const [owner, seller, buyer, other] = await ethers.getSigners();

  const nft = await ethers.deployContract("AegisNFT");
  await nft.waitForDeployment();

  const marketplace = await ethers.deployContract("AegisMarketplace", [owner.address, await nft.getAddress(), FEE_BPS]);
  await marketplace.waitForDeployment();

  return { owner, seller, buyer, other, nft, marketplace };
}

async function mintAndList() {
  const ctx = await deploySystem();
  const { seller, nft, marketplace } = ctx;
  const marketplaceAddress = await marketplace.getAddress();

  await nft.connect(seller).mint(URI_ONE);
  await nft.connect(seller).approve(marketplaceAddress, 1n);
  await marketplace.connect(seller).createListing(await nft.getAddress(), 1n, PRICE);

  return { ...ctx, listingId: 1n };
}

describe("AegisNFT", function () {
  it("mints sequential ERC-721 tokens with IPFS metadata", async function () {
    const { seller, nft } = await deploySystem();

    await expect(nft.connect(seller).mint(URI_ONE))
      .to.emit(nft, "NFTMinted")
      .withArgs(1n, seller.address, URI_ONE);

    await nft.connect(seller).mint(URI_TWO);

    expect(await nft.ownerOf(1n)).to.equal(seller.address);
    expect(await nft.ownerOf(2n)).to.equal(seller.address);
    expect(await nft.tokenURI(1n)).to.equal(URI_ONE);
    expect(await nft.creatorOf(1n)).to.equal(seller.address);
    expect(await nft.nextTokenId()).to.equal(3n);
  });

  it("rejects an empty metadata URI", async function () {
    const { seller, nft } = await deploySystem();
    await expect(nft.connect(seller).mint("")).to.be.revertedWithCustomError(nft, "EmptyTokenURI");
  });

  it("rejects non-IPFS metadata URIs", async function () {
    const { seller, nft } = await deploySystem();
    await expect(nft.connect(seller).mint("https://example.com/metadata.json"))
      .to.be.revertedWithCustomError(nft, "InvalidTokenURI");
  });

  it("preserves creator provenance after ownership transfer", async function () {
    const { seller, buyer, nft } = await deploySystem();
    await nft.connect(seller).mint(URI_ONE);
    await nft.connect(seller).transferFrom(seller.address, buyer.address, 1n);

    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(await nft.creatorOf(1n)).to.equal(seller.address);
  });
});

describe("AegisMarketplace — listing", function () {
  it("escrows an approved NFT and creates an active listing", async function () {
    const { seller, nft, marketplace } = await deploySystem();
    const marketplaceAddress = await marketplace.getAddress();

    await nft.connect(seller).mint(URI_ONE);
    await nft.connect(seller).approve(marketplaceAddress, 1n);

    await expect(marketplace.connect(seller).createListing(await nft.getAddress(), 1n, PRICE))
      .to.emit(marketplace, "NFTListed")
      .withArgs(1n, await nft.getAddress(), 1n, seller.address, PRICE);

    expect(await nft.ownerOf(1n)).to.equal(marketplaceAddress);
    expect(await marketplace.activeListingByAsset(await nft.getAddress(), 1n)).to.equal(1n);

    const listing = await marketplace.getListing(1n);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.price).to.equal(PRICE);
    expect(listing.feeBps).to.equal(FEE_BPS);
    expect(listing.active).to.equal(true);
  });

  it("rejects zero-price listings", async function () {
    const { seller, nft, marketplace } = await deploySystem();
    await nft.connect(seller).mint(URI_ONE);
    await nft.connect(seller).approve(await marketplace.getAddress(), 1n);

    await expect(marketplace.connect(seller).createListing(await nft.getAddress(), 1n, 0n))
      .to.be.revertedWithCustomError(marketplace, "InvalidPrice");
  });

  it("rejects listings from non-owners", async function () {
    const { seller, other, nft, marketplace } = await deploySystem();
    await nft.connect(seller).mint(URI_ONE);

    await expect(marketplace.connect(other).createListing(await nft.getAddress(), 1n, PRICE))
      .to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
  });

  it("requires marketplace approval before escrow", async function () {
    const { seller, nft, marketplace } = await deploySystem();
    await nft.connect(seller).mint(URI_ONE);

    await expect(marketplace.connect(seller).createListing(await nft.getAddress(), 1n, PRICE))
      .to.be.revertedWithCustomError(marketplace, "MarketplaceNotApproved");
  });

  it("prevents duplicate active listings for the same token", async function () {
    const { seller, nft, marketplace } = await deploySystem();
    await nft.connect(seller).mint(URI_ONE);
    await nft.connect(seller).approve(await marketplace.getAddress(), 1n);
    await marketplace.connect(seller).createListing(await nft.getAddress(), 1n, PRICE);

    await expect(marketplace.connect(seller).createListing(await nft.getAddress(), 1n, PRICE))
      .to.be.revertedWithCustomError(marketplace, "AlreadyListed");
  });

  it("rejects NFTs from contracts outside the canonical AegisMint collection", async function () {
    const { seller, marketplace } = await deploySystem();
    const foreignNft = await ethers.deployContract("AegisNFT");
    await foreignNft.waitForDeployment();
    await foreignNft.connect(seller).mint(URI_ONE);
    await foreignNft.connect(seller).approve(await marketplace.getAddress(), 1n);

    await expect(
      marketplace.connect(seller).createListing(await foreignNft.getAddress(), 1n, PRICE),
    ).to.be.revertedWithCustomError(marketplace, "UnsupportedNFTContract");
  });

  it("rejects unsolicited safe transfers into marketplace custody", async function () {
    const { seller, nft, marketplace } = await deploySystem();
    await nft.connect(seller).mint(URI_ONE);

    await expect(
      nft.connect(seller)["safeTransferFrom(address,address,uint256)"](
        seller.address,
        await marketplace.getAddress(),
        1n,
      ),
    ).to.be.revertedWithCustomError(marketplace, "UnexpectedNFTTransfer");

    expect(await nft.ownerOf(1n)).to.equal(seller.address);
  });
});

describe("AegisMarketplace — purchasing", function () {
  it("atomically transfers ownership and settles seller proceeds", async function () {
    const { seller, buyer, nft, marketplace, listingId } = await mintAndList();
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const fee = (PRICE * FEE_BPS) / 10_000n;
    const proceeds = PRICE - fee;

    await expect(marketplace.connect(buyer).buyNFT(listingId, { value: PRICE }))
      .to.emit(marketplace, "NFTSold")
      .withArgs(
        listingId,
        await nft.getAddress(),
        1n,
        seller.address,
        buyer.address,
        PRICE,
        fee,
      );

    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
    expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(proceeds);
    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(await marketplace.accruedFees()).to.equal(fee);

    const listing = await marketplace.getListing(listingId);
    expect(listing.active).to.equal(false);
    expect(listing.sold).to.equal(true);
    expect(listing.buyer).to.equal(buyer.address);
  });

  it("rejects underpayment and overpayment", async function () {
    const { buyer, marketplace, listingId } = await mintAndList();

    await expect(marketplace.connect(buyer).buyNFT(listingId, { value: PRICE - 1n }))
      .to.be.revertedWithCustomError(marketplace, "IncorrectPayment")
      .withArgs(PRICE, PRICE - 1n);

    await expect(marketplace.connect(buyer).buyNFT(listingId, { value: PRICE + 1n }))
      .to.be.revertedWithCustomError(marketplace, "IncorrectPayment")
      .withArgs(PRICE, PRICE + 1n);
  });

  it("prevents the seller from buying their own listing", async function () {
    const { seller, marketplace, listingId } = await mintAndList();
    await expect(marketplace.connect(seller).buyNFT(listingId, { value: PRICE }))
      .to.be.revertedWithCustomError(marketplace, "CannotBuyOwnNFT");
  });

  it("prevents double purchase", async function () {
    const { buyer, other, marketplace, listingId } = await mintAndList();
    await marketplace.connect(buyer).buyNFT(listingId, { value: PRICE });

    await expect(marketplace.connect(other).buyNFT(listingId, { value: PRICE }))
      .to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("updates aggregate marketplace stats", async function () {
    const { buyer, marketplace, listingId } = await mintAndList();

    let stats = await marketplace.marketplaceStats();
    expect(stats[0]).to.equal(1n);
    expect(stats[1]).to.equal(1n);
    expect(stats[2]).to.equal(0n);

    await marketplace.connect(buyer).buyNFT(listingId, { value: PRICE });
    stats = await marketplace.marketplaceStats();

    expect(stats[1]).to.equal(0n);
    expect(stats[2]).to.equal(1n);
    expect(stats[3]).to.equal(PRICE);
  });
});

describe("AegisMarketplace — cancellation and resale", function () {
  it("allows only the seller to cancel an active listing", async function () {
    const { seller, other, nft, marketplace, listingId } = await mintAndList();

    await expect(marketplace.connect(other).cancelListing(listingId))
      .to.be.revertedWithCustomError(marketplace, "UnauthorizedSeller");

    await expect(marketplace.connect(seller).cancelListing(listingId))
      .to.emit(marketplace, "ListingCancelled")
      .withArgs(listingId, await nft.getAddress(), 1n, seller.address);

    expect(await nft.ownerOf(1n)).to.equal(seller.address);
    expect((await marketplace.getListing(listingId)).active).to.equal(false);
  });

  it("prevents purchase after cancellation", async function () {
    const { seller, buyer, marketplace, listingId } = await mintAndList();
    await marketplace.connect(seller).cancelListing(listingId);
    await expect(marketplace.connect(buyer).buyNFT(listingId, { value: PRICE }))
      .to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("allows a buyer to resell the purchased NFT", async function () {
    const { buyer, other, nft, marketplace, listingId } = await mintAndList();
    await marketplace.connect(buyer).buyNFT(listingId, { value: PRICE });

    const resalePrice = ethers.parseEther("0.2");
    await nft.connect(buyer).approve(await marketplace.getAddress(), 1n);
    await marketplace.connect(buyer).createListing(await nft.getAddress(), 1n, resalePrice);

    const resale = await marketplace.getListing(2n);
    expect(resale.seller).to.equal(buyer.address);
    expect(resale.price).to.equal(resalePrice);

    await marketplace.connect(other).buyNFT(2n, { value: resalePrice });
    expect(await nft.ownerOf(1n)).to.equal(other.address);
  });
});

describe("AegisMarketplace — fees and administration", function () {
  it("caps marketplace fees at 10%", async function () {
    const { owner, marketplace } = await deploySystem();

    await marketplace.connect(owner).setMarketplaceFee(1_000);
    expect(await marketplace.marketplaceFeeBps()).to.equal(1_000n);

    await expect(marketplace.connect(owner).setMarketplaceFee(1_001))
      .to.be.revertedWithCustomError(marketplace, "FeeTooHigh");
  });

  it("snapshots the fee when a listing is created", async function () {
    const { owner, seller, buyer, nft, marketplace } = await deploySystem();
    await nft.connect(seller).mint(URI_ONE);
    await nft.connect(seller).approve(await marketplace.getAddress(), 1n);
    await marketplace.connect(seller).createListing(await nft.getAddress(), 1n, PRICE);

    await marketplace.connect(owner).setMarketplaceFee(1_000);
    const originalFee = (PRICE * FEE_BPS) / 10_000n;
    await marketplace.connect(buyer).buyNFT(1n, { value: PRICE });

    expect(await marketplace.accruedFees()).to.equal(originalFee);
    expect((await marketplace.getListing(1n)).feeBps).to.equal(FEE_BPS);
  });

  it("prevents non-owner fee changes", async function () {
    const { other, marketplace } = await deploySystem();
    await expect(marketplace.connect(other).setMarketplaceFee(100))
    .to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount")
    .withArgs(other.address);
  });

  it("lets the owner withdraw only accrued marketplace fees", async function () {
    const { owner, buyer, marketplace, listingId } = await mintAndList();
    const fee = (PRICE * FEE_BPS) / 10_000n;
    await marketplace.connect(buyer).buyNFT(listingId, { value: PRICE });

    await expect(marketplace.connect(owner).withdrawFees(owner.address, fee + 1n))
      .to.be.revertedWithCustomError(marketplace, "InvalidPrice");

    await expect(marketplace.connect(owner).withdrawFees(owner.address, fee))
      .to.emit(marketplace, "FeesWithdrawn")
      .withArgs(owner.address, fee);

    expect(await marketplace.accruedFees()).to.equal(0n);
  });

  it("rejects direct ETH payments outside purchase flow", async function () {
    const { buyer, marketplace } = await deploySystem();
    await expect(
      buyer.sendTransaction({ to: await marketplace.getAddress(), value: 1n }),
    ).to.be.revertedWithCustomError(marketplace, "DirectPaymentsNotAccepted");
  });
});

describe("AegisMarketplace — defensive settlement", function () {
  it("completes a sale even when the seller rejects ETH and defers proceeds", async function () {
    const [owner, buyer, recipient] = await ethers.getSigners();
    const nft = await ethers.deployContract("AegisNFT");
    await nft.waitForDeployment();
    const marketplace = await ethers.deployContract("AegisMarketplace", [owner.address, await nft.getAddress(), FEE_BPS]);
    const revertingSeller = await ethers.deployContract("RevertingSeller");
    await Promise.all([marketplace.waitForDeployment(), revertingSeller.waitForDeployment()]);

    await revertingSeller.mintApproveAndList(
      await nft.getAddress(),
      await marketplace.getAddress(),
      URI_ONE,
      PRICE,
    );

    const fee = (PRICE * FEE_BPS) / 10_000n;
    const proceeds = PRICE - fee;

    await expect(marketplace.connect(buyer).buyNFT(1n, { value: PRICE }))
      .to.emit(marketplace, "ProceedsDeferred")
      .withArgs(1n, await revertingSeller.getAddress(), proceeds);

    expect(await nft.ownerOf(1n)).to.equal(buyer.address);
    expect(await marketplace.pendingProceeds(await revertingSeller.getAddress())).to.equal(proceeds);
    expect(await marketplace.totalDeferredProceeds()).to.equal(proceeds);

    const recipientBefore = await ethers.provider.getBalance(recipient.address);
    await expect(
      revertingSeller.attemptWithdraw(await marketplace.getAddress(), recipient.address),
    ).to.emit(marketplace, "ProceedsWithdrawn")
      .withArgs(await revertingSeller.getAddress(), recipient.address, proceeds);
    const recipientAfter = await ethers.provider.getBalance(recipient.address);

    expect(recipientAfter - recipientBefore).to.equal(proceeds);
    expect(await marketplace.pendingProceeds(await revertingSeller.getAddress())).to.equal(0n);
    expect(await marketplace.totalDeferredProceeds()).to.equal(0n);
  });
});

describe("AegisMarketplace — pagination", function () {
  it("returns active listings and excludes cancelled ones", async function () {
    const { seller, nft, marketplace } = await deploySystem();
    const market = await marketplace.getAddress();

    await nft.connect(seller).mint(URI_ONE);
    await nft.connect(seller).mint(URI_TWO);
    await nft.connect(seller).setApprovalForAll(market, true);

    await marketplace.connect(seller).createListing(await nft.getAddress(), 1n, PRICE);
    await marketplace.connect(seller).createListing(await nft.getAddress(), 2n, PRICE * 2n);
    await marketplace.connect(seller).cancelListing(1n);

    const [active, nextCursor] = await marketplace.getActiveListings(0n, 25n);
    expect(active.length).to.equal(1);
    expect(active[0].id).to.equal(2n);
    expect(nextCursor).to.equal(2n);
  });

  it("rejects unsafe page sizes", async function () {
    const { marketplace } = await deploySystem();
    await expect(marketplace.getActiveListings(0n, 0n))
      .to.be.revertedWithCustomError(marketplace, "InvalidPageSize");
    await expect(marketplace.getActiveListings(0n, 101n))
      .to.be.revertedWithCustomError(marketplace, "InvalidPageSize");
  });
});
