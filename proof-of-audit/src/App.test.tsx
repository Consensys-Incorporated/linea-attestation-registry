import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App.tsx";

const WalletAppMock = () => (
  <form aria-label="Audit attestation">
    <label htmlFor="repoUrl">Repository</label>
    <input id="repoUrl" name="repoUrl" />
    <label htmlFor="commitHash">Commit</label>
    <input id="commitHash" name="commitHash" />
    <label htmlFor="contractAddress">Contract</label>
    <input id="contractAddress" name="contractAddress" />
    <button type="button">Connect wallet</button>
  </form>
);

const successfulWalletLoad = async () => ({ default: WalletAppMock });

describe("App wallet loading", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  it("renders Start attestation without loading the wallet chunk", () => {
    const loadWalletApp = vi.fn(successfulWalletLoad);
    render(<App loadWalletApp={loadWalletApp} reloadPage={() => undefined} walletProjectId="test-project-id" />);

    expect(screen.getByRole("button", { name: "Start attestation" })).toBeInTheDocument();
    expect(loadWalletApp).not.toHaveBeenCalled();
  });

  it("renders the wallet control after Start attestation loads the chunk", async () => {
    render(<App loadWalletApp={successfulWalletLoad} walletProjectId="test-project-id" />);

    fireEvent.click(screen.getByRole("button", { name: "Start attestation" }));

    expect(await screen.findByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(screen.getByLabelText("Commit")).toBeInTheDocument();
  });

  it("renders the wallet app when the chunk resolves after a delay", async () => {
    const loadWalletApp = vi.fn(
      () =>
        new Promise<{ default: typeof WalletAppMock }>((resolve) => {
          setTimeout(() => resolve({ default: WalletAppMock }), 20);
        }),
    );
    render(<App loadWalletApp={loadWalletApp} walletProjectId="test-project-id" />);

    fireEvent.click(screen.getByRole("button", { name: "Start attestation" }));

    expect(await screen.findByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(loadWalletApp).toHaveBeenCalledTimes(1);
  });

  it("shows an accessible chunk-load error and recovers on retry", async () => {
    let shouldFail = true;
    const loadWalletApp = vi.fn(async () => {
      if (shouldFail) {
        throw new Error("Failed to fetch dynamically imported module");
      }
      return { default: WalletAppMock };
    });
    render(<App loadWalletApp={loadWalletApp} reloadPage={() => undefined} walletProjectId="test-project-id" />);
    fireEvent.click(screen.getByRole("button", { name: "Start attestation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/connection/i);
    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
  });

  it("surfaces a preload rejection instead of an unhandled rejection", async () => {
    const unhandled = vi.fn();
    const loadWalletApp = vi.fn(async () => {
      throw new Error("Failed to fetch dynamically imported module");
    });
    window.addEventListener("unhandledrejection", unhandled);
    render(<App loadWalletApp={loadWalletApp} walletProjectId="test-project-id" />);
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Start attestation" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed to load/i);
    expect(unhandled).not.toHaveBeenCalled();
    window.removeEventListener("unhandledrejection", unhandled);
  });

  it("shows a missing-configuration error without blanking the page", async () => {
    const loadWalletApp = vi.fn(successfulWalletLoad);
    render(<App loadWalletApp={loadWalletApp} walletProjectId="" />);
    fireEvent.click(screen.getByRole("button", { name: "Start attestation" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Wallet setup is missing.");
    expect(alert).not.toHaveTextContent("VITE_WALLETCONNECT_PROJECT_ID");
    expect(alert).not.toHaveTextContent("A project id is not invented here.");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(loadWalletApp).not.toHaveBeenCalled();
  });
});
