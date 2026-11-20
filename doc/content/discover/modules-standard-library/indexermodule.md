# IndexerModule

Source: `contracts/src/stdlib/IndexerModuleV2.sol`

## What it does

`IndexerModuleV2` stores onchain secondary indexes for attestation IDs by:

- subject;
- subject + schema;
- attester;
- schema;
- portal;
- portal + subject.

This is useful when another contract wants queryable attestation IDs without relying on an offchain indexer.

## Who can write to the index

`run(...)` only accepts calls from the `ModuleRegistry`, and only for a portal that is registered in the
`PortalRegistry`. The `ModuleRegistry` sets the `portal` argument to its own caller, so a direct caller cannot index
data on behalf of another portal.

`indexAttestation(...)` and `indexAttestations(...)` are open to anyone. They only read attestations that already exist
in the `AttestationRegistry`.

## Query methods

The module exposes view helpers such as:

- `getAttestationIdsBySubject(...)`
- `getAttestationIdsBySubjectBySchema(...)`
- `getAttestationIdsByAttester(...)`
- `getAttestationIdsBySchema(...)`
- `getAttestationIdsByPortal(...)`
- `getAttestationIdsByPortalBySubject(...)`

## Important caveats

:::warning

This module has significant limitations in its current form:

- it does not un-index revoked attestations;
- it is not reliable for bulk issuance scenarios that depend on predicted IDs;
- it trusts a registered portal to attest the payloads it runs through the `ModuleRegistry`, so consumers should read
  the attestation from the `AttestationRegistry` before they rely on an indexed ID;
- it should be treated as advanced or experimental tooling rather than the default discovery path.

:::

For most applications, the subgraph remains the recommended indexing layer.
