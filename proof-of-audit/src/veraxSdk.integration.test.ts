// @vitest-environment node
import { type IncomingMessage, createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { type Attestation, type Conf, type Schema, VeraxSdk } from "@verax-attestation-registry/verax-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LINEA_MAINNET_CHAIN_ID, LINEA_SEPOLIA_CHAIN_ID, PORTAL_ID, SCHEMA_ID } from "./utils/constants.ts";

// Schema string registered on-chain for SCHEMA_ID.
const ABI_SCHEMA = "(string commitHash, string repoUrl)";
const COMMIT_HASH = "a".repeat(40);
const REPO_URL = "https://github.com/example/project";
const ATTESTATION_DATA = [{ commitHash: COMMIT_HASH, repoUrl: REPO_URL }];
const SUBJECT = "0x2222222222222222222222222222222222222222";
const ATTESTER = "0x1111111111111111111111111111111111111111";
const TRANSACTION_RESULT = `0x${"0".repeat(64)}` as const;

type GraphqlMode = "attestations" | "empty" | "invalid-data" | "schema" | "http-error" | "interrupt";

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let graphqlMode: GraphqlMode;
let rpcCalls: string[];
let rpcChainIds: number[];

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const schemaRecord = (): Schema => ({
  id: SCHEMA_ID,
  name: "Proof of Audit",
  description: "Audit reference",
  context: "https://example.test",
  schema: ABI_SCHEMA,
  attestationCounter: 1,
});

const attestationRecord = (sdk: VeraxSdk): Attestation => ({
  id: `0x${"ab".repeat(32)}`,
  attestationId: `0x${"ab".repeat(32)}`,
  replacedBy: `0x${"00".repeat(32)}`,
  attester: ATTESTER,
  attestedDate: 1,
  expirationDate: 2_000_000_000,
  revocationDate: 0,
  version: 1,
  revoked: false,
  subject: SUBJECT,
  encodedSubject: "0x",
  attestationData: sdk.utils.encode(ABI_SCHEMA, ATTESTATION_DATA),
  decodedData: [],
  decodedPayload: {},
  schema: schemaRecord(),
  portal: {
    id: PORTAL_ID,
    ownerAddress: ATTESTER,
    modules: [],
    isRevocable: false,
    name: "Proof of Audit",
    description: "Test portal",
    ownerName: "Local test",
    attestationCounter: 1,
  },
});

const createSdk = (conf: Conf): VeraxSdk =>
  new VeraxSdk({
    ...conf,
    rpcUrl: `${baseUrl}/rpc/${conf.chain.id}`,
    subgraphUrl: `${baseUrl}/graphql`,
  });

describe("Verax SDK against local GraphQL and JSON-RPC transports", () => {
  beforeEach(async () => {
    vi.stubGlobal("window", {});
    graphqlMode = "attestations";
    rpcCalls = [];
    rpcChainIds = [];

    server = createServer(async (request, response) => {
      const body = await readBody(request);

      if (request.url === "/graphql") {
        if (graphqlMode === "interrupt") {
          request.socket.destroy();
          return;
        }
        if (graphqlMode === "http-error") {
          response.writeHead(503, { "content-type": "application/json" });
          response.end(JSON.stringify({ errors: [{ message: "offline" }] }));
          return;
        }

        const sdk = new VeraxSdk(VeraxSdk.DEFAULT_LINEA_MAINNET);
        const query = JSON.parse(body).query as string;
        const data = query.includes("query get_schema")
          ? { schema: schemaRecord() }
          : graphqlMode === "empty"
            ? { attestations: [] }
            : {
                attestations: [
                  graphqlMode === "invalid-data"
                    ? { ...attestationRecord(sdk), attestationData: "0xdead" }
                    : attestationRecord(sdk),
                ],
              };

        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data }));
        return;
      }

      const rpc = JSON.parse(body) as { id: number; method: string };
      rpcCalls.push(rpc.method);
      const pathSegments = request.url?.split("/") ?? [];
      const chainId = Number(pathSegments[pathSegments.length - 1]);
      rpcChainIds.push(chainId);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: rpc.id,
          result: rpc.method === "eth_chainId" ? `0x${chainId.toString(16)}` : TRANSACTION_RESULT,
        }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it("executes a real attestation query and decodes the committed schema payload", async () => {
    const sdk = createSdk(VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND);
    const attestations = await sdk.attestation.findBy(1, 0, {
      subject: SUBJECT,
    });

    expect(attestations).toHaveLength(1);
    expect(attestations[0]?.decodedPayload).toEqual([
      {
        commitHash: COMMIT_HASH,
        repoUrl: REPO_URL,
      },
    ]);
  });

  it("preserves an empty successful result", async () => {
    graphqlMode = "empty";
    const sdk = createSdk(VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND);

    await expect(sdk.attestation.findBy(1, 0)).resolves.toEqual([]);
  });

  it("does not decode an invalid ABI payload as valid attestation data", async () => {
    graphqlMode = "invalid-data";
    const sdk = createSdk(VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND);

    const attestations = await sdk.attestation.findBy(1, 0);
    expect(attestations).toHaveLength(1);
    expect(attestations[0]?.attestationData).toBe("0xdead");
    expect(attestations[0]?.decodedPayload).toEqual([]);
  });

  it("surfaces an HTTP error from the GraphQL transport", async () => {
    graphqlMode = "http-error";
    const sdk = createSdk(VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND);

    await expect(sdk.attestation.findBy(1, 0)).rejects.toThrow("Request failed with status code 503");
  });

  it("propagates a GraphQL transport interruption", async () => {
    graphqlMode = "interrupt";
    const sdk = createSdk(VeraxSdk.DEFAULT_LINEA_MAINNET_FRONTEND);

    await expect(sdk.attestation.findBy(1, 0)).rejects.toThrow();
  });

  it.each([
    ["Linea Mainnet", VeraxSdk.DEFAULT_LINEA_MAINNET, LINEA_MAINNET_CHAIN_ID],
    ["Linea Sepolia", VeraxSdk.DEFAULT_LINEA_SEPOLIA, LINEA_SEPOLIA_CHAIN_ID],
  ] as const)(
    "prepares the real Verax SDK attestation call on %s using local transports",
    async (_name, network, chainId) => {
      const sdk = createSdk(network);
      const request = await sdk.portal.simulateAttest(
        PORTAL_ID,
        {
          schemaId: SCHEMA_ID,
          expirationDate: 2_000_000_000,
          subject: SUBJECT,
          attestationData: ATTESTATION_DATA,
        },
        [],
      );

      expect(request.functionName).toBe("attest");
      expect(request.args).toBeDefined();
      expect(JSON.stringify(request.args)).toContain(sdk.utils.encode(ABI_SCHEMA, ATTESTATION_DATA));
      expect(rpcCalls).toContain("eth_call");
      expect(rpcChainIds.every((rpcChainId) => rpcChainId === chainId)).toBe(true);
      expect(chainId).toBe(network.chain.id);
    },
  );
});
