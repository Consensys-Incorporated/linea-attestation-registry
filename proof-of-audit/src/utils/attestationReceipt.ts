import { type Address, type Hex, isAddressEqual } from "viem";

import { getAttestationRegistryAddress } from "./constants.ts";

export const ATTESTATION_REGISTERED_EVENT_TOPIC = "0xfe10586889e06530420fe4a0d86aa4f7afc3c9dc84b0c77b731a9615496ef18a";

type ReceiptLog = {
  address: Address;
  topics: readonly Hex[];
};

export const extractAttestationIdFromReceipt = (
  chainId: number | undefined,
  logs: readonly ReceiptLog[],
): Hex | undefined => {
  const attestationRegistryAddress = getAttestationRegistryAddress(chainId);

  if (!attestationRegistryAddress) {
    return undefined;
  }

  const attestationLog = logs.find(
    (log) =>
      isAddressEqual(log.address, attestationRegistryAddress) && log.topics[0] === ATTESTATION_REGISTERED_EVENT_TOPIC,
  );

  return attestationLog?.topics[1];
};
