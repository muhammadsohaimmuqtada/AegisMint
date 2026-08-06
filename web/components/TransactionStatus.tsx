export type TransactionStage =
  | "idle"
  | "uploading-asset"
  | "uploading-metadata"
  | "awaiting-wallet"
  | "pending"
  | "confirmed"
  | "error";

const labels: Record<TransactionStage, string> = {
  idle: "Ready",
  "uploading-asset": "Uploading asset to IPFS",
  "uploading-metadata": "Publishing metadata to IPFS",
  "awaiting-wallet": "Awaiting wallet confirmation",
  pending: "Transaction submitted — waiting for Sepolia",
  confirmed: "Confirmed on Sepolia",
  error: "Transaction failed",
};

export function TransactionStatus({
  stage,
  hash,
  message,
}: {
  stage: TransactionStage;
  hash?: `0x${string}`;
  message?: string;
}) {
  if (stage === "idle") return null;

  return (
    <div className={`txStatus ${stage}`} role="status">
      <div className="txStatusRow">
        <span className="txPulse" />
        <strong>{labels[stage]}</strong>
      </div>
      {message ? <p>{message}</p> : null}
      {hash ? (
        <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer">
          View transaction ↗
        </a>
      ) : null}
    </div>
  );
}
