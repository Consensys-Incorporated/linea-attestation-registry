import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ATTESTATION_REGISTERED_EVENT_TOPIC,
  extractAttestationIdFromReceipt,
} from "../src/utils/attestationReceipt.ts";
import { LINEA_SEPOLIA_ATTESTATION_REGISTRY_ADDRESS, LINEA_SEPOLIA_CHAIN_ID } from "../src/utils/constants.ts";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

const readProjectFile = (path) => {
  return readFileSync(join(repoRoot, path), "utf8");
};

const filesThatMustNotReferenceInfuraClientKey = [
  ".env.example",
  "README.md",
  "src/vite-env.d.ts",
  "src/wagmiConfig.ts",
];

for (const file of filesThatMustNotReferenceInfuraClientKey) {
  const contents = readProjectFile(file);
  assert.equal(contents.includes("VITE_INFURA_API_KEY"), false, `${file} still references VITE_INFURA_API_KEY`);
}

const walkFiles = (directory) => {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...walkFiles(path));
    } else {
      files.push(path);
    }
  }

  return files;
};

const distPath = join(repoRoot, "dist");
if (existsSync(distPath)) {
  const textAssetExtensions = new Set([".css", ".html", ".js"]);

  for (const file of walkFiles(distPath)) {
    if (!textAssetExtensions.has(extname(file))) {
      continue;
    }

    const contents = readFileSync(file, "utf8");
    assert.equal(contents.includes("codex_infura_key"), false, `${file} leaked the Infura sentinel value`);
  }
}

const validAttestationId = `0x${"a".repeat(64)}`;
const unrelatedAttestationId = `0x${"b".repeat(64)}`;

const unrelatedFirstLog = {
  address: "0x0000000000000000000000000000000000000001",
  topics: [ATTESTATION_REGISTERED_EVENT_TOPIC, unrelatedAttestationId],
};
const wrongTopicLog = {
  address: LINEA_SEPOLIA_ATTESTATION_REGISTRY_ADDRESS,
  topics: [`0x${"c".repeat(64)}`, unrelatedAttestationId],
};
const validAttestationLog = {
  address: LINEA_SEPOLIA_ATTESTATION_REGISTRY_ADDRESS,
  topics: [ATTESTATION_REGISTERED_EVENT_TOPIC, validAttestationId],
};

assert.equal(
  extractAttestationIdFromReceipt(LINEA_SEPOLIA_CHAIN_ID, [unrelatedFirstLog, wrongTopicLog, validAttestationLog]),
  validAttestationId,
  "expected extraction to skip unrelated first logs and return the valid attestation event",
);

assert.equal(
  extractAttestationIdFromReceipt(LINEA_SEPOLIA_CHAIN_ID, [unrelatedFirstLog, wrongTopicLog]),
  undefined,
  "expected extraction to reject receipts without the Verax attestation event",
);

assert.equal(
  extractAttestationIdFromReceipt(1, [validAttestationLog]),
  undefined,
  "expected extraction to reject unsupported chains",
);

// Mutation sensitivity: these fixtures call the production helper. A wrong
// registry address or topic in the expected matching log makes extraction
// return undefined and fails the assertion above. Do not copy the filter.
//
// extractAttestationIdFromReceipt does not receive or check receipt status.
// A reverted receipt can still contain a matching log. Rejecting
// status !== 'success' belongs to AuditForm and is covered by the POA-01
// component test, not by a fake status check here.

const childEnv = { ...process.env };
delete childEnv.VITE_WALLETCONNECT_PROJECT_ID;

const missingProjectId = spawnSync(process.execPath, ["scripts/check-missing-walletconnect-project-id.mjs"], {
  cwd: repoRoot,
  env: childEnv,
  encoding: "utf8",
});

assert.equal(
  missingProjectId.status,
  0,
  `importing wagmiConfig without VITE_WALLETCONNECT_PROJECT_ID must fail\nstdout: ${missingProjectId.stdout}\nstderr: ${missingProjectId.stderr}`,
);
assert.match(
  `${missingProjectId.stdout}\n${missingProjectId.stderr}`,
  /Missing VITE_WALLETCONNECT_PROJECT_ID/,
  "missing project id check must report the production configuration error",
);
