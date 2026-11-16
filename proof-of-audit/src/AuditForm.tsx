import { type ChangeEvent, type FocusEvent, type FormEvent, memo, useCallback, useRef, useState } from "react";
import { type Address, type Hex, isAddress } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { useAccount } from "wagmi";

import ConnectButton from "./components/ConnectButton.tsx";
import { useVeraxSdk } from "./hooks/useVeraxSdk.ts";
import { extractAttestationIdFromReceipt } from "./utils/attestationReceipt.ts";
import {
  ATTESTATION_VALIDITY_SECONDS,
  LINEA_MAINNET_CHAIN_ID,
  LINEA_SEPOLIA_CHAIN_ID,
  PORTAL_ID,
  SCHEMA_ID,
  getBlockExplorerTxUrl,
  getVeraxExplorerAttestationUrl,
  isSupportedLineaChainId,
} from "./utils/constants.ts";
import { isValidGithubRepositoryUrl } from "./utils/repoUrl.ts";
import { wagmiConfig } from "./wagmiConfig.ts";

type FormValues = {
  commitHash: string;
  repoUrl: string;
  contractAddress: string;
};

type FormErrors = {
  commitHash: string;
  repoUrl: string;
  contractAddress: string;
};

type FormFieldName = keyof FormValues;

type FormFieldConfig = {
  name: FormFieldName;
  label: string;
  type: "text" | "url";
  placeholder: string;
  autoComplete: string;
  spellCheck?: boolean;
};

type SubmissionOrigin = {
  account: Address;
  chainId: number;
  txExplorerUrl?: string;
  attestationExplorerUrl?: string;
};

type StatusState = {
  type: "idle" | "pending" | "success" | "error";
  txHash?: Hex;
  attestationId?: Hex;
  errorMessage?: string;
  origin?: SubmissionOrigin;
};

const COMMIT_HASH_PATTERN = /^[0-9a-f]{40}$/;
const FORM_FIELDS: readonly FormFieldConfig[] = [
  {
    name: "repoUrl",
    label: "Repository",
    type: "url",
    placeholder: "https://github.com/owner/repo",
    autoComplete: "url",
  },
  {
    name: "commitHash",
    label: "Commit",
    type: "text",
    placeholder: "37f8ecd53a64ba2395b7de0a8d7ecb0dbfdced64",
    autoComplete: "off",
    spellCheck: false,
  },
  {
    name: "contractAddress",
    label: "Contract",
    type: "text",
    placeholder: "0x...",
    autoComplete: "off",
    spellCheck: false,
  },
];

const validateField = (name: FormFieldName, value: string): string => {
  switch (name) {
    case "commitHash":
      return COMMIT_HASH_PATTERN.test(value) ? "" : "Expected 40 lowercase hex characters";
    case "repoUrl":
      return isValidGithubRepositoryUrl(value) ? "" : "Expected https://github.com/owner/repo";
    case "contractAddress":
      return isAddress(value) ? "" : "Invalid address";
    default:
      return "";
  }
};

const truncateHexString = (hexString: string): string => `${hexString.slice(0, 7)}...${hexString.slice(-5)}`;

const lineaChainLabel = (chainId: number): string => {
  if (chainId === LINEA_MAINNET_CHAIN_ID) {
    return "Linea Mainnet";
  }
  if (chainId === LINEA_SEPOLIA_CHAIN_ID) {
    return "Linea Sepolia";
  }
  return `chain ${chainId}`;
};

const errorText = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "Unexpected error.";
  }
  // viem errors carry a one-line summary; their message holds the full trace.
  return "shortMessage" in error && typeof error.shortMessage === "string" ? error.shortMessage : error.message;
};

type AuditFormFieldProps = FormFieldConfig & {
  value: string;
  error: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: FocusEvent<HTMLInputElement>) => void;
};

const AuditFormField = memo(function AuditFormField({
  name,
  label,
  type,
  placeholder,
  autoComplete,
  spellCheck,
  value,
  error,
  onChange,
  onBlur,
}: Readonly<AuditFormFieldProps>) {
  const errorId = `${name}-error`;

  return (
    <div className="form-group">
      <label htmlFor={name} className="form-label">
        {label}
      </label>
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`form-input ${error ? "has-error" : ""}`}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoComplete={autoComplete}
        spellCheck={spellCheck}
      />
      {error ? (
        <div id={errorId} className="form-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
});

const AuditForm = () => {
  const [inputValues, setInputValues] = useState<FormValues>({
    commitHash: "",
    repoUrl: "",
    contractAddress: "",
  });
  const [errors, setErrors] = useState<FormErrors>({
    commitHash: "",
    repoUrl: "",
    contractAddress: "",
  });
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const inFlightRef = useRef(false);

  const { address, chainId } = useAccount();
  const veraxSdk = useVeraxSdk(chainId, address);
  const { commitHash, repoUrl, contractAddress } = inputValues;

  const isValidChain = isSupportedLineaChainId(chainId);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as FormFieldName;

    setInputValues((prev) => ({ ...prev, [fieldName]: value }));

    setErrors((prev) => (prev[fieldName] ? { ...prev, [fieldName]: "" } : prev));
  }, []);

  const handleBlur = useCallback((e: FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldName = name as FormFieldName;

    setErrors((prev) => ({
      ...prev,
      [fieldName]: validateField(fieldName, value),
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Disabling the button is not a mutex: React applies it only after
      // render. A second submit can run before that unless this ref is set
      // synchronously, before any await.
      if (inFlightRef.current) {
        return;
      }

      const newErrors: FormErrors = {
        commitHash: validateField("commitHash", commitHash),
        repoUrl: validateField("repoUrl", repoUrl),
        contractAddress: validateField("contractAddress", contractAddress),
      };
      setErrors(newErrors);

      const hasValidationErrors = Boolean(newErrors.commitHash || newErrors.repoUrl || newErrors.contractAddress);
      if (hasValidationErrors) {
        return;
      }

      inFlightRef.current = true;

      const capturedAccount = address;
      const capturedChainId = chainId;
      const capturedSdk = veraxSdk;
      const capturedSubject = contractAddress;
      const capturedCommitHash = commitHash;
      const capturedRepoUrl = repoUrl;
      const capturedPortalId = PORTAL_ID;
      const origin: SubmissionOrigin | undefined =
        capturedAccount && typeof capturedChainId === "number"
          ? { account: capturedAccount, chainId: capturedChainId }
          : undefined;

      setStatus({ type: "pending", origin });

      try {
        if (!isSupportedLineaChainId(capturedChainId)) {
          setStatus({
            type: "error",
            origin,
            errorMessage: "Switch to a Linea network.",
          });
          return;
        }

        const supportedChainId =
          capturedChainId === LINEA_MAINNET_CHAIN_ID ? LINEA_MAINNET_CHAIN_ID : LINEA_SEPOLIA_CHAIN_ID;

        if (!capturedAccount || !capturedSdk) {
          setStatus({
            type: "error",
            origin,
            errorMessage: "Connect a wallet on Linea.",
          });
          return;
        }

        const receiptClient = wagmiConfig.getClient({
          chainId: supportedChainId,
        });

        if (!receiptClient) {
          setStatus({
            type: "error",
            origin,
            errorMessage: "Network unavailable. Switch network and retry.",
          });
          return;
        }

        const expirationDate = Math.floor(Date.now() / 1000) + ATTESTATION_VALIDITY_SECONDS;

        const receipt = await capturedSdk.portal.attest(
          capturedPortalId,
          {
            schemaId: SCHEMA_ID,
            expirationDate,
            subject: capturedSubject,
            // The registered schema is one tuple: (string commitHash, string repoUrl).
            attestationData: [
              {
                commitHash: capturedCommitHash,
                repoUrl: capturedRepoUrl,
              },
            ],
          },
          [],
        );

        if (!receipt.transactionHash) {
          setStatus({
            type: "error",
            origin,
            errorMessage: "No transaction hash returned.",
          });
          return;
        }

        const pendingOrigin: SubmissionOrigin = {
          account: capturedAccount,
          chainId: supportedChainId,
          txExplorerUrl: getBlockExplorerTxUrl(supportedChainId, receipt.transactionHash),
        };

        setStatus({
          type: "pending",
          txHash: receipt.transactionHash,
          origin: pendingOrigin,
        });

        const finalReceipt = await waitForTransactionReceipt(receiptClient, {
          hash: receipt.transactionHash,
        });

        if (finalReceipt.status !== "success") {
          setStatus({
            type: "error",
            txHash: receipt.transactionHash,
            origin: pendingOrigin,
            errorMessage: "Transaction failed.",
          });
          return;
        }

        const attestationId = extractAttestationIdFromReceipt(supportedChainId, finalReceipt.logs);

        if (!attestationId) {
          setStatus({
            type: "error",
            txHash: receipt.transactionHash,
            origin: pendingOrigin,
            errorMessage: "No attestation found in the receipt.",
          });
          return;
        }

        setStatus({
          type: "success",
          txHash: receipt.transactionHash,
          attestationId,
          origin: {
            ...pendingOrigin,
            attestationExplorerUrl: getVeraxExplorerAttestationUrl(supportedChainId, attestationId),
          },
        });
      } catch (error) {
        setStatus({ type: "error", origin, errorMessage: errorText(error) });
      } finally {
        inFlightRef.current = false;
      }
    },
    [address, chainId, commitHash, contractAddress, repoUrl, veraxSdk],
  );

  const hasErrors = Boolean(errors.commitHash || errors.repoUrl || errors.contractAddress);
  const isEmpty = !commitHash || !repoUrl || !contractAddress;
  const isPending = status.type === "pending";

  const isSubmitDisabled = !address || !veraxSdk || !isValidChain || hasErrors || isEmpty || isPending;

  const { origin } = status;
  const isOtherWallet = origin !== undefined && (address !== origin.account || chainId !== origin.chainId);
  let resultTitle: string | null = null;
  if (status.type === "success") {
    resultTitle = "Attested";
  } else if (isPending && status.txHash) {
    resultTitle = "Confirming…";
  }

  return (
    <>
      <div className="wallet-bar">
        <ConnectButton />
      </div>

      {address && !isValidChain ? (
        <p className="notice error" role="alert">
          Switch to a Linea network.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="panel form" noValidate>
        {FORM_FIELDS.map((field) => (
          <AuditFormField
            key={field.name}
            {...field}
            value={inputValues[field.name]}
            error={errors[field.name]}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        ))}

        <button type="submit" disabled={isSubmitDisabled} className="submit-button" aria-busy={isPending}>
          {isPending ? "Attesting…" : "Attest"}
        </button>
      </form>

      {status.txHash && origin?.txExplorerUrl ? (
        <section className="panel result" role="status" aria-live="polite" aria-label="Result">
          {resultTitle ? <p className={`result-title ${status.type}`}>{resultTitle}</p> : null}
          <dl className="result-rows">
            <dt>Transaction</dt>
            <dd>
              <a href={origin.txExplorerUrl} target="_blank" rel="noopener noreferrer">
                {truncateHexString(status.txHash)}
              </a>
            </dd>
            {status.type === "success" && status.attestationId && origin.attestationExplorerUrl ? (
              <>
                <dt>Attestation</dt>
                <dd>
                  <a href={origin.attestationExplorerUrl} target="_blank" rel="noopener noreferrer">
                    {truncateHexString(status.attestationId)}
                  </a>
                </dd>
              </>
            ) : null}
            {isOtherWallet ? (
              <>
                <dt>Sent by</dt>
                <dd title={origin.account}>
                  {truncateHexString(origin.account)} on {lineaChainLabel(origin.chainId)}
                </dd>
              </>
            ) : null}
          </dl>
        </section>
      ) : null}

      {status.type === "error" && status.errorMessage ? (
        <p className="notice error" role="alert">
          {status.errorMessage}
        </p>
      ) : null}
    </>
  );
};

export default AuditForm;
