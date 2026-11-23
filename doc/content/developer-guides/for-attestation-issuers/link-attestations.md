# Link Attestations

In Verax, the standard way to link attestations is to issue another attestation that uses the canonical `Relationship`
schema.

## Canonical relationship schemas

Bootstrapped in post-deployment:

```text
Relationship: (bytes32 subject, string predicate, bytes32 object)
namedGraphRelationship: (string namedGraph, bytes32 subject, string predicate, bytes32 object)
```

Canonical IDs:

- `Relationship`: `0x41b8c81288eebbf173b2f54b9fb2f1d37f2caca51ef39e8f99299b53c2599a3a`
- `namedGraphRelationship`: `0x8f83a0ef7871f63455a506f6bca0db98a88721764ae6dbde2afddd8e12e442b8`

Each ID is the `keccak256` hash of the schema string, parentheses included. Some older deployments also hold a legacy
form without parentheses. Do not use the legacy form for new attestations.

## Example relationship

You can model:

```text
Attestation A "isMemberOf" Attestation B
```

by issuing a relationship attestation whose encoded payload contains:

- `subject = Attestation A`
- `predicate = "isMemberOf"`
- `object = Attestation B`

## Important modeling note

The relationship semantics live inside the encoded payload. The outer Verax `subject` field of the relationship
attestation is still your choice.

Many teams mirror the relationship subject there for easier indexing, but that is a convention, not a protocol rule.

## Issuing a relationship attestation

There is no dedicated SDK helper for creating relationship attestations today. You simply issue a normal attestation
through a portal that supports the canonical relationship schema.

The SDK does provide a read helper:

```ts
const related = await veraxSdk.attestation.getRelatedAttestations(attestationId);
```

## When to use named graphs

Use `namedGraphRelationship` when the same two attestations may be related in several distinct scopes and you need to
label that scope explicitly.

## Related reads

- [Linked Data](../../core-concepts/linked-data.md)
- [Canonical Schemas](../../core-concepts/canonical-schemas.md)
