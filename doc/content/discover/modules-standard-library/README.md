# Modules Standard Library

This section documents the reusable modules shipped in `contracts/src/stdlib/`.

These modules are good starting points when you do not want to write custom validation logic from scratch.

## Included modules

- [ECDSAModule](ecdsamodule.md)
- [ERC1271Module](erc1271module.md)
- [FeeModule](feemodule.md)
- [IndexerModule](indexermodule.md)
- [IssuersModule](issuersmodule.md)
- [SchemaModule](schemamodule.md)
- [SenderModule](sendermodule.md)

## How to use a standard-library module

1. Deploy the module or reuse an existing deployment on your target chain.
2. Configure it if the module exposes per-portal settings.
3. Register it in `ModuleRegistry`, or reuse a registered deployment. Portals cannot run unregistered modules:
   `ModuleRegistry.runModulesV2(...)` reverts with `ModuleNotRegistered`.
4. Include its address in your portal's module list.
