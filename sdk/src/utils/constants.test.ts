import { keccak256, toHex } from "viem";
import { Constants } from "./constants";

describe("Constants", () => {
  // Same strings as contracts/script/deploy/postDeployment.ts
  it.each([
    ["RELATIONSHIP_SCHEMA_ID", "(bytes32 subject, string predicate, bytes32 object)"],
    ["NAMED_GRAPH_RELATIONSHIP_SCHEMA_ID", "(string namedGraph, bytes32 subject, string predicate, bytes32 object)"],
    ["OFFCHAIN_DATA_SCHEMA_ID", "(bytes32 schemaId, string uri)"],
  ] as const)("%s should be the hash of the canonical schema string", (constant, schemaString) => {
    expect(Constants[constant]).toBe(keccak256(toHex(schemaString)));
  });
});
