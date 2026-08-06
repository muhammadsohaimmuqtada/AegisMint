import { PinataSDK } from "pinata";

export function getServerPinata() {
  const jwt = process.env.PINATA_JWT;
  const gateway = process.env.PINATA_GATEWAY ?? process.env.NEXT_PUBLIC_PINATA_GATEWAY;

  if (!jwt || !gateway) {
    throw new Error("Pinata server configuration is incomplete");
  }

  return new PinataSDK({
    pinataJwt: jwt,
    pinataGateway: gateway,
  });
}
