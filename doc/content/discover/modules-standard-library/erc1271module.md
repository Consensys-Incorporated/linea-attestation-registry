# ERC1271Module

Source: `contracts/src/stdlib/ERC1271ModuleV2.sol`

## What it does

`ERC1271ModuleV2` extends the ECDSA-style signer authorization pattern to smart contract wallets that implement
ERC-1271.

The module:

1. decodes `validationPayload` as `abi.encode(address signer, bytes signature)`;
2. checks that `signer` against the portal's authorized signer list;
3. computes `keccak256(abi.encode(attestationPayload))` and applies the Ethereum signed message prefix;
4. validates the signature with OpenZeppelin `SignatureChecker`:
   - an EOA signer must be the address recovered from the ECDSA signature;
   - a contract signer must return the ERC-1271 magic value from `isValidSignature(...)`.

A contract wallet cannot be recovered from its signature. This is why the payload must name the signer.

## Validation payload

```solidity
bytes memory validationPayload = abi.encode(signer, signature);
```

For a contract wallet, `signer` is the wallet address and `signature` is the value that the wallet expects in
`isValidSignature(...)`. A raw signature without the signer is not a valid payload.

## Portal-owner configuration

```solidity
function setAuthorizedSigners(address portal, address[] calldata signers, bool[] calldata authorizationStatus) public;
```

## Good fit when

- you want Gnosis Safe or other contract-wallet signers;
- your issuer workflow uses multisigs or account abstraction wallets.

## Tradeoffs

- more complex than `ECDSAModuleV2`;
- extra contract call for contract-wallet validation;
- still no built-in replay protection.

## Practical advice

Use `ECDSAModuleV2` if you only need EOAs. Use `ERC1271ModuleV2` when smart-wallet compatibility is part of the
requirement.
