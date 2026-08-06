export function toIpfsUri(cid: string): string {
  return `ipfs://${cid}`;
}

export function ipfsToHttp(uri?: string | null): string {
  if (!uri) return "";
  if (!uri.startsWith("ipfs://")) return uri;
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY;
  const cidPath = uri.slice("ipfs://".length);
  return gateway ? `https://${gateway}/ipfs/${cidPath}` : `https://ipfs.io/ipfs/${cidPath}`;
}

export function shortAddress(address?: string): string {
  if (!address) return "—";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
