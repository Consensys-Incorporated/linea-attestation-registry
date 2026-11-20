// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { Test, Vm } from "forge-std/Test.sol";
import { Router } from "../../src/Router.sol";
import { OperationType } from "../../src/types/Enums.sol";
import { Attestation, AttestationPayload } from "../../src/types/Structs.sol";
import { AttestationRegistry } from "../../src/AttestationRegistry.sol";
import { ModuleRegistry } from "../../src/ModuleRegistry.sol";
import { SchemaRegistry } from "../../src/SchemaRegistry.sol";
import { PortalRegistry } from "../../src/PortalRegistry.sol";
import { IndexerModuleV2 } from "../../src/stdlib/IndexerModuleV2.sol";
import { DefaultPortalV2 } from "../../src/DefaultPortalV2.sol";
import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract IndexerModuleIntegrationTest is Test {
  address public issuerAddress = makeAddr("issuer");
  address public user = makeAddr("user");
  Router public router = new Router();
  SchemaRegistry public schemaRegistry;
  PortalRegistry public portalRegistry;
  ModuleRegistry public moduleRegistry;
  AttestationRegistry public attestationRegistry;
  IndexerModuleV2 public indexerModule;
  DefaultPortalV2 public portal;
  bytes32 public schemaId;
  address[] public modules;
  bytes[] public validationPayloads;

  function setUp() public {
    router.initialize();

    address proxyAdmin = makeAddr("proxyAdmin");

    attestationRegistry = AttestationRegistry(
      address(
        new TransparentUpgradeableProxy(
          address(new AttestationRegistry()),
          proxyAdmin,
          abi.encodeWithSelector(
            AttestationRegistry.initialize.selector,
            address(router),
            0x0003000000000000000000000000000000000000000000000000000000000000
          )
        )
      )
    );
    router.updateAttestationRegistry(address(attestationRegistry));

    portalRegistry = PortalRegistry(
      address(
        new TransparentUpgradeableProxy(
          address(new PortalRegistry()),
          proxyAdmin,
          abi.encodeWithSelector(PortalRegistry.initialize.selector, address(router), false)
        )
      )
    );
    router.updatePortalRegistry(address(portalRegistry));

    schemaRegistry = SchemaRegistry(
      address(
        new TransparentUpgradeableProxy(
          address(new SchemaRegistry()),
          proxyAdmin,
          abi.encodeWithSelector(SchemaRegistry.initialize.selector, address(router))
        )
      )
    );
    router.updateSchemaRegistry(address(schemaRegistry));

    moduleRegistry = ModuleRegistry(
      address(
        new TransparentUpgradeableProxy(
          address(new ModuleRegistry()),
          proxyAdmin,
          abi.encodeWithSelector(ModuleRegistry.initialize.selector, address(router))
        )
      )
    );
    router.updateModuleRegistry(address(moduleRegistry));

    indexerModule = new IndexerModuleV2(address(attestationRegistry), address(portalRegistry), address(moduleRegistry));

    portalRegistry.setIssuer(issuerAddress);

    vm.startPrank(issuerAddress);
    moduleRegistry.register("IndexerModule", "IndexerModule description", address(indexerModule));

    schemaId = schemaRegistry.getIdFromSchemaString("(bool isBuidler)");
    schemaRegistry.createSchema("Buidler", "Describes a buidler", "https://schema.org/Property", "(bool isBuidler)");

    modules.push(address(indexerModule));
    validationPayloads.push(bytes(""));

    vm.recordLogs();
    portalRegistry.deployDefaultPortal(modules, "IndexedPortal", "IndexedPortal description", true, "Verax");
    Vm.Log[] memory entries = vm.getRecordedLogs();
    (, , address portalAddress) = abi.decode(entries[0].data, (string, string, address));
    portal = DefaultPortalV2(portalAddress);
    vm.stopPrank();
  }

  function test_attest_IndexesTheRegisteredAttestation() public {
    AttestationPayload memory payload = _payload(abi.encode(user));
    bytes32 expectedAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(user);
    portal.attest(payload, validationPayloads);

    Attestation memory attestation = attestationRegistry.getAttestation(expectedAttestationId);
    assertEq(attestation.subject, payload.subject);
    assertEq(attestation.portal, address(portal));

    assertTrue(indexerModule.getIndexedAttestationStatus(expectedAttestationId));
    _assertSingleId(indexerModule.getAttestationIdsBySubject(payload.subject), expectedAttestationId);
    _assertSingleId(indexerModule.getAttestationIdsBySubjectBySchema(payload.subject, schemaId), expectedAttestationId);
    _assertSingleId(indexerModule.getAttestationIdsByAttester(attestation.attester), expectedAttestationId);
    _assertSingleId(indexerModule.getAttestationIdsBySchema(schemaId), expectedAttestationId);
    _assertSingleId(indexerModule.getAttestationIdsByPortal(address(portal)), expectedAttestationId);
    _assertSingleId(
      indexerModule.getAttestationIdsByPortalBySubject(address(portal), payload.subject),
      expectedAttestationId
    );
  }

  function test_attest_IndexesEachAttestationOnce() public {
    bytes32 firstId = attestationRegistry.getNextAttestationId();
    vm.prank(user);
    portal.attest(_payload(abi.encode(user)), validationPayloads);

    bytes32 secondId = attestationRegistry.getNextAttestationId();
    vm.prank(user);
    portal.attest(_payload(abi.encode(user)), validationPayloads);

    // A later call to the registry-backed indexing must not duplicate the entries
    indexerModule.indexAttestation(firstId);

    bytes32[] memory attestationIds = indexerModule.getAttestationIdsByPortal(address(portal));
    assertEq(attestationIds.length, 2);
    assertEq(attestationIds[0], firstId);
    assertEq(attestationIds[1], secondId);
  }

  function test_run_DirectCallCannotForgeAnIndex() public {
    AttestationPayload memory forgedPayload = _payload(abi.encode(makeAddr("victim")));
    bytes32 nextAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(user);
    vm.expectRevert(IndexerModuleV2.OnlyModuleRegistry.selector);
    indexerModule.run(forgedPayload, bytes(""), user, 0, user, address(portal), OperationType.Attest);

    assertFalse(indexerModule.getIndexedAttestationStatus(nextAttestationId));
    assertEq(indexerModule.getAttestationIdsByPortal(address(portal)).length, 0);
  }

  function test_runModulesV2_UnregisteredCallerCannotForgeAnIndex() public {
    AttestationPayload memory forgedPayload = _payload(abi.encode(makeAddr("victim")));
    bytes32 nextAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(user);
    vm.expectRevert(IndexerModuleV2.OnlyRegisteredPortal.selector);
    moduleRegistry.runModulesV2(modules, forgedPayload, validationPayloads, 0, user, user, OperationType.Attest);

    assertFalse(indexerModule.getIndexedAttestationStatus(nextAttestationId));
    assertEq(indexerModule.getAttestationIdsBySubject(forgedPayload.subject).length, 0);
  }

  function _payload(bytes memory subject) private view returns (AttestationPayload memory) {
    return AttestationPayload(schemaId, 0, subject, abi.encode(true));
  }

  function _assertSingleId(bytes32[] memory attestationIds, bytes32 expectedAttestationId) private pure {
    assertEq(attestationIds.length, 1);
    assertEq(attestationIds[0], expectedAttestationId);
  }
}
