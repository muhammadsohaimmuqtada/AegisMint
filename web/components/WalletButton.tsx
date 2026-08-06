"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { shortAddress } from "@/lib/ipfs";

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <button
        className="walletButton"
        disabled={!connector || isPending}
        onClick={() => connector && connect({ connector })}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
    );
  }

  if (chainId !== sepolia.id) {
    return (
      <button className="walletButton warning" disabled={switching} onClick={() => switchChain({ chainId: sepolia.id })}>
        {switching ? "Switching…" : "Switch to Sepolia"}
      </button>
    );
  }

  return (
    <button className="walletButton connected" onClick={() => disconnect()} title="Disconnect wallet">
      <span className="statusDot" />
      {shortAddress(address)}
    </button>
  );
}
