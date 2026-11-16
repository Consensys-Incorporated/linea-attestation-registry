import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type Address, type Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccount } from "wagmi";

import AuditForm from "./AuditForm.tsx";
import { useVeraxSdk } from "./hooks/useVeraxSdk.ts";
import { ATTESTATION_REGISTERED_EVENT_TOPIC } from "./utils/attestationReceipt.ts";
import {
  LINEA_MAINNET_CHAIN_ID,
  LINEA_SEPOLIA_CHAIN_ID,
  PORTAL_ID,
  SCHEMA_ID,
  getAttestationRegistryAddress,
  getBlockExplorerTxUrl,
  getVeraxExplorerAttestationUrl,
} from "./utils/constants.ts";
import { wagmiConfig } from "./wagmiConfig.ts";

vi.mock("wagmi", () => ({
  useAccount: vi.fn(),
}));

vi.mock("./hooks/useVeraxSdk.ts", () => ({
  useVeraxSdk: vi.fn(),
}));

vi.mock("./wagmiConfig.ts", () => ({
  wagmiConfig: {
    getClient: vi.fn(),
  },
}));

vi.mock("viem/actions", () => ({
  waitForTransactionReceipt: vi.fn(),
}));

const SUBMITTING_ACCOUNT = "0x1111111111111111111111111111111111111111" as Address;
const OTHER_ACCOUNT = "0x2222222222222222222222222222222222222222" as Address;
const CONTRACT_ADDRESS = "0x3333333333333333333333333333333333333333" as Address;
const COMMIT_HASH = "37f8ecd53a64ba2395b7de0a8d7ecb0dbfdced64";
const REPO_URL = "https://github.com/owner/repo";
const TX_HASH = `0x${"ab".repeat(32)}` as Hex;
const ATTESTATION_ID = `0x${"cd".repeat(32)}` as Hex;

type AccountState = {
  address?: Address;
  chainId?: number;
};

type ReceiptClient = {
  chainId: number;
};

const accountState: AccountState = {};
const receiptClients = new Map<number, ReceiptClient>();

const attest = vi.fn();
const sdk = {
  portal: {
    attest,
  },
};

const getClientMock = vi.mocked(wagmiConfig.getClient);
const waitForReceiptMock = vi.mocked(waitForTransactionReceipt);

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const attestationLog = (chainId: number, attestationId: Hex = ATTESTATION_ID) => {
  const address = getAttestationRegistryAddress(chainId);
  if (!address) {
    throw new Error(`No registry for chain ${chainId}`);
  }

  return {
    address,
    topics: [ATTESTATION_REGISTERED_EVENT_TOPIC, attestationId] as const,
  };
};

const fillValidForm = () => {
  fireEvent.change(screen.getByLabelText("Repository"), {
    target: { value: REPO_URL },
  });
  fireEvent.change(screen.getByLabelText("Commit"), {
    target: { value: COMMIT_HASH },
  });
  fireEvent.change(screen.getByLabelText("Contract"), {
    target: { value: CONTRACT_ADDRESS },
  });
};

const getForm = () => {
  const form = document.querySelector("form");
  if (!form) {
    throw new Error("Attestation form was not rendered");
  }
  return form;
};

const submitForm = (form: ParentNode | HTMLFormElement = getForm()) => {
  fireEvent.submit(form as HTMLFormElement);
  return form;
};

const renderForm = () => {
  vi.mocked(useAccount).mockImplementation(
    () =>
      ({
        address: accountState.address,
        chainId: accountState.chainId,
      }) as ReturnType<typeof useAccount>,
  );
  vi.mocked(useVeraxSdk).mockImplementation(() => sdk as never);

  return render(<AuditForm />);
};

describe("AuditForm transaction lifecycle", () => {
  beforeEach(() => {
    cleanup();
    attest.mockReset();
    getClientMock.mockReset();
    waitForReceiptMock.mockReset();
    receiptClients.clear();
    accountState.address = SUBMITTING_ACCOUNT;
    accountState.chainId = LINEA_SEPOLIA_CHAIN_ID;

    getClientMock.mockImplementation((parameters?: { chainId?: number }) => {
      const chainId = parameters?.chainId ?? accountState.chainId;
      if (typeof chainId !== "number") {
        return undefined as never;
      }
      const existing = receiptClients.get(chainId);
      if (existing) {
        return existing as never;
      }
      const client = { chainId };
      receiptClients.set(chainId, client);
      return client as never;
    });
  });

  it("calls portal.attest once when the form is submitted twice before the first await", async () => {
    const pendingAttest = deferred<{ transactionHash: Hex }>();
    attest.mockReturnValue(pendingAttest.promise);
    renderForm();
    fillValidForm();

    const form = getForm();
    fireEvent.submit(form);
    fireEvent.submit(form);

    await waitFor(() => {
      expect(attest).toHaveBeenCalledTimes(1);
    });
    expect(attest).toHaveBeenCalledTimes(1);

    pendingAttest.resolve({ transactionHash: TX_HASH });
    waitForReceiptMock.mockResolvedValue({
      status: "success",
      logs: [attestationLog(LINEA_SEPOLIA_CHAIN_ID)],
    } as never);
    expect(await screen.findByText(/^Attestation$/)).toBeInTheDocument();
    expect(attest).toHaveBeenCalledTimes(1);
  });

  it("keeps the receipt client and explorer link on the chain captured during the SDK wait", async () => {
    const pendingAttest = deferred<{ transactionHash: Hex }>();
    const pendingReceipt = deferred<{ status: string; logs: unknown[] }>();
    attest.mockReturnValue(pendingAttest.promise);
    waitForReceiptMock.mockReturnValue(pendingReceipt.promise as never);
    const view = renderForm();
    fillValidForm();

    submitForm();

    await waitFor(() => {
      expect(getClientMock).toHaveBeenCalledWith({
        chainId: LINEA_SEPOLIA_CHAIN_ID,
      });
    });
    expect(attest).toHaveBeenCalledTimes(1);
    expect(waitForReceiptMock).not.toHaveBeenCalled();

    accountState.address = OTHER_ACCOUNT;
    accountState.chainId = LINEA_MAINNET_CHAIN_ID;
    view.rerender(<AuditForm />);

    expect(attest).toHaveBeenCalledTimes(1);
    expect(getClientMock).toHaveBeenCalledTimes(1);
    expect(getClientMock).toHaveBeenCalledWith({
      chainId: LINEA_SEPOLIA_CHAIN_ID,
    });

    pendingAttest.resolve({ transactionHash: TX_HASH });

    const txLink = await screen.findByRole("link", {
      name: /0xabab/,
    });
    expect(txLink).toHaveAttribute("href", getBlockExplorerTxUrl(LINEA_SEPOLIA_CHAIN_ID, TX_HASH));
    expect(screen.getByTitle(SUBMITTING_ACCOUNT)).toHaveTextContent("Linea Sepolia");
    expect(waitForReceiptMock).toHaveBeenCalledWith(receiptClients.get(LINEA_SEPOLIA_CHAIN_ID), { hash: TX_HASH });

    pendingReceipt.resolve({
      status: "success",
      logs: [attestationLog(LINEA_SEPOLIA_CHAIN_ID)],
    });

    const attestationLink = await screen.findByRole("link", {
      name: /0xcdcd/,
    });
    expect(attestationLink).toHaveAttribute(
      "href",
      getVeraxExplorerAttestationUrl(LINEA_SEPOLIA_CHAIN_ID, ATTESTATION_ID),
    );
    expect(getClientMock).toHaveBeenCalledTimes(1);
    expect(attest).toHaveBeenCalledTimes(1);
  });

  it("does not retarget the explorer link or receipt client if the account changes during the receipt wait", async () => {
    const pendingReceipt = deferred<{ status: string; logs: unknown[] }>();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    waitForReceiptMock.mockReturnValue(pendingReceipt.promise as never);
    const view = renderForm();
    fillValidForm();

    submitForm();

    const txLink = await screen.findByRole("link", { name: /0xabab/ });
    expect(txLink).toHaveAttribute("href", getBlockExplorerTxUrl(LINEA_SEPOLIA_CHAIN_ID, TX_HASH));
    expect(getClientMock).toHaveBeenCalledWith({
      chainId: LINEA_SEPOLIA_CHAIN_ID,
    });

    accountState.address = OTHER_ACCOUNT;
    accountState.chainId = LINEA_MAINNET_CHAIN_ID;
    view.rerender(<AuditForm />);

    expect(screen.getByRole("link", { name: /0xabab/ })).toHaveAttribute(
      "href",
      getBlockExplorerTxUrl(LINEA_SEPOLIA_CHAIN_ID, TX_HASH),
    );
    expect(screen.getByTitle(SUBMITTING_ACCOUNT)).toHaveTextContent("Linea Sepolia");
    expect(waitForReceiptMock).toHaveBeenCalledTimes(1);
    expect(waitForReceiptMock).toHaveBeenCalledWith(receiptClients.get(LINEA_SEPOLIA_CHAIN_ID), { hash: TX_HASH });
    expect(getClientMock).not.toHaveBeenCalledWith({
      chainId: LINEA_MAINNET_CHAIN_ID,
    });

    pendingReceipt.resolve({
      status: "success",
      logs: [attestationLog(LINEA_SEPOLIA_CHAIN_ID)],
    });

    expect(await screen.findByText(/^Attestation$/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0xcdcd/ })).toHaveAttribute(
      "href",
      getVeraxExplorerAttestationUrl(LINEA_SEPOLIA_CHAIN_ID, ATTESTATION_ID),
    );
    expect(screen.getByRole("link", { name: /0xabab/ })).toHaveAttribute(
      "href",
      getBlockExplorerTxUrl(LINEA_SEPOLIA_CHAIN_ID, TX_HASH),
    );
    expect(attest).toHaveBeenCalledTimes(1);
  });

  it("shows the wallet rejection and does not report success", async () => {
    attest.mockRejectedValue(new Error("User rejected the request"));
    renderForm();
    fillValidForm();

    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("User rejected the request");
    expect(screen.queryByText(/^Attestation$/)).not.toBeInTheDocument();
    expect(attest).toHaveBeenCalledTimes(1);
  });

  it("treats a reverted receipt as an error even when an attestation log is present", async () => {
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    waitForReceiptMock.mockResolvedValue({
      status: "reverted",
      logs: [attestationLog(LINEA_SEPOLIA_CHAIN_ID)],
    } as never);
    renderForm();
    fillValidForm();

    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("Transaction failed");
    expect(screen.queryByText(/^Attestation$/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0xabab/ })).toHaveAttribute(
      "href",
      getBlockExplorerTxUrl(LINEA_SEPOLIA_CHAIN_ID, TX_HASH),
    );
  });

  it("reports a missing transaction hash as an error", async () => {
    attest.mockResolvedValue({});
    renderForm();
    fillValidForm();

    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("No transaction hash returned.");
    expect(waitForReceiptMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/^Attestation$/)).not.toBeInTheDocument();
  });

  it("reports a missing attestation event as an error", async () => {
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    waitForReceiptMock.mockResolvedValue({
      status: "success",
      logs: [],
    } as never);
    renderForm();
    fillValidForm();

    submitForm();

    expect(await screen.findByRole("alert")).toHaveTextContent("No attestation found in the receipt.");
    expect(screen.queryByText(/^Attestation$/)).not.toBeInTheDocument();
  });

  it("does not call the SDK when the captured chain is not a supported Linea network", async () => {
    accountState.chainId = 1;
    renderForm();
    fillValidForm();

    submitForm();

    // The chain banner and the submit error both render.
    expect(await screen.findAllByText("Switch to a Linea network.")).toHaveLength(2);
    expect(attest).not.toHaveBeenCalled();
    expect(waitForReceiptMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "Linea Sepolia",
      chainId: LINEA_SEPOLIA_CHAIN_ID,
    },
    {
      name: "Linea Mainnet",
      chainId: LINEA_MAINNET_CHAIN_ID,
    },
  ])("preserves the attestation payload and explorer links on $name", async ({ chainId }) => {
    accountState.chainId = chainId;
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    waitForReceiptMock.mockResolvedValue({
      status: "success",
      logs: [attestationLog(chainId)],
    } as never);
    renderForm();
    fillValidForm();

    submitForm();

    expect(await screen.findByText(/^Attestation$/)).toBeInTheDocument();
    expect(attest).toHaveBeenCalledTimes(1);
    expect(attest).toHaveBeenCalledWith(
      PORTAL_ID,
      {
        schemaId: SCHEMA_ID,
        expirationDate: expect.any(Number),
        subject: CONTRACT_ADDRESS,
        attestationData: [
          {
            commitHash: COMMIT_HASH,
            repoUrl: REPO_URL,
          },
        ],
      },
      [],
    );
    const expirationDate = attest.mock.calls[0]?.[1]?.expirationDate as number;
    expect(expirationDate).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(screen.getByRole("link", { name: /0xabab/ })).toHaveAttribute(
      "href",
      getBlockExplorerTxUrl(chainId, TX_HASH),
    );
    expect(screen.getByRole("link", { name: /0xcdcd/ })).toHaveAttribute(
      "href",
      getVeraxExplorerAttestationUrl(chainId, ATTESTATION_ID),
    );
    expect(getClientMock).toHaveBeenCalledWith({ chainId });
  });

  it("does not clear a pending transaction when the account changes", async () => {
    const pendingReceipt = deferred<{ status: string; logs: unknown[] }>();
    attest.mockResolvedValue({ transactionHash: TX_HASH });
    waitForReceiptMock.mockReturnValue(pendingReceipt.promise as never);
    const view = renderForm();
    fillValidForm();
    submitForm();

    expect(await screen.findByText(/Confirming/)).toBeInTheDocument();

    accountState.address = OTHER_ACCOUNT;
    view.rerender(<AuditForm />);

    expect(screen.getByText(/Confirming/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /0xabab/ })).toHaveAttribute(
      "href",
      getBlockExplorerTxUrl(LINEA_SEPOLIA_CHAIN_ID, TX_HASH),
    );
    expect(waitForReceiptMock).toHaveBeenCalledTimes(1);

    pendingReceipt.resolve({
      status: "success",
      logs: [attestationLog(LINEA_SEPOLIA_CHAIN_ID)],
    });
    expect(await screen.findByText(/^Attestation$/)).toBeInTheDocument();
  });
});
