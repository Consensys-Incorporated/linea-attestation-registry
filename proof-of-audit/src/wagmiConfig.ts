import type { AppKitNetwork } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { http } from "wagmi";
import { linea, lineaSepolia } from "wagmi/chains";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

if (!walletConnectProjectId) {
  throw new Error("Missing VITE_WALLETCONNECT_PROJECT_ID environment variable");
}

export { walletConnectProjectId };

export const metadata = {
  name: "Proof of Audit",
  description: "Issue attestation of audits",
  url: "https://audit.examples.ver.ax",
  icons: ["https://audit.examples.ver.ax/verax-logo-circle.svg"],
};

// Cast to mutable array for appkit compatibility
export const chains: [AppKitNetwork, ...AppKitNetwork[]] = [lineaSepolia, linea];

const rpcTransportOptions = {
  timeout: 10_000,
  retryCount: 3,
  retryDelay: 1_000,
};

export const wagmiAdapter = new WagmiAdapter({
  networks: chains,
  transports: {
    [linea.id]: http(linea.rpcUrls.default.http[0], rpcTransportOptions),
    [lineaSepolia.id]: http(lineaSepolia.rpcUrls.default.http[0], rpcTransportOptions),
  },
  projectId: walletConnectProjectId,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
