import { type Address } from "viem";
import { linea, lineaSepolia } from "wagmi/chains";

// Verax Portal and Schema IDs
export const PORTAL_ID: Address = "0xbb92965c718852a8dc1b6e930239de4e08d93e60";
export const SCHEMA_ID: Address = "0x59ffe1d5bdbd99d418fc1dba03b136176ca52da322cab38fed6f29c2ca29bd71";

// Attestation validity period (30 days in seconds)
export const ATTESTATION_VALIDITY_SECONDS = 30 * 24 * 60 * 60; // 2_592_000

// Chain IDs
export const LINEA_MAINNET_CHAIN_ID = linea.id;
export const LINEA_SEPOLIA_CHAIN_ID = lineaSepolia.id;

export const LINEA_MAINNET_ATTESTATION_REGISTRY_ADDRESS: Address = "0x3de3893aa4Cdea029e84e75223a152FD08315138";
export const LINEA_SEPOLIA_ATTESTATION_REGISTRY_ADDRESS: Address = "0xDaf3C3632327343f7df0Baad2dc9144fa4e1001F";

const SUPPORTED_LINEA_CHAIN_IDS = new Set<number>([LINEA_MAINNET_CHAIN_ID, LINEA_SEPOLIA_CHAIN_ID]);

const ATTESTATION_REGISTRY_ADDRESSES_BY_CHAIN_ID: Record<number, Address> = {
  [LINEA_MAINNET_CHAIN_ID]: LINEA_MAINNET_ATTESTATION_REGISTRY_ADDRESS,
  [LINEA_SEPOLIA_CHAIN_ID]: LINEA_SEPOLIA_ATTESTATION_REGISTRY_ADDRESS,
};

export const isSupportedLineaChainId = (chainId?: number): chainId is number =>
  typeof chainId === "number" && SUPPORTED_LINEA_CHAIN_IDS.has(chainId);

export const getAttestationRegistryAddress = (chainId?: number): Address | undefined => {
  return typeof chainId === "number" ? ATTESTATION_REGISTRY_ADDRESSES_BY_CHAIN_ID[chainId] : undefined;
};

// Block explorer URLs
export const getBlockExplorerTxUrl = (chainId: number, txHash: string) => {
  return chainId === LINEA_MAINNET_CHAIN_ID
    ? `https://lineascan.build/tx/${txHash}`
    : `https://sepolia.lineascan.build/tx/${txHash}`;
};

export const getVeraxExplorerAttestationUrl = (chainId: number, attestationId: string) => {
  return chainId === LINEA_MAINNET_CHAIN_ID
    ? `https://explorer.ver.ax/linea/attestations/${attestationId}`
    : `https://explorer.ver.ax/linea-sepolia/attestations/${attestationId}`;
};
