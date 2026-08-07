import { PinataSDK } from "pinata";

let serverPinata: PinataSDK | undefined;

function normalizeGateway(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
}

export function getServerPinata() {
  if (serverPinata) return serverPinata;

  const jwt = process.env.PINATA_JWT?.trim();
  const rawGateway = process.env.PINATA_GATEWAY ?? process.env.NEXT_PUBLIC_PINATA_GATEWAY;
  const gateway = rawGateway ? normalizeGateway(rawGateway) : "";

  if (!jwt || jwt === "replace_me" || jwt === "YOUR_PINATA_JWT") {
    throw new Error("PINATA_JWT is not configured");
  }
  if (!gateway || gateway.includes("your-gateway") || gateway.includes("example.")) {
    throw new Error("Pinata gateway is not configured");
  }

  serverPinata = new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: gateway,
  });
  return serverPinata;
}
