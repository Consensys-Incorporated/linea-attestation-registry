// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { Test } from "forge-std/Test.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { IndexerModuleV2 } from "../../src/stdlib/IndexerModuleV2.sol";
import { OperationType } from "../../src/types/Enums.sol";
import { AttestationPayload } from "../../src/types/Structs.sol";
import { PortalRegistryMock } from "../mocks/PortalRegistryMock.sol";
import { AttestationRegistryMock } from "../mocks/AttestationRegistryMock.sol";
import { SchemaRegistryMock } from "../mocks/SchemaRegistryMock.sol";
import { Router } from "../../src/Router.sol";

contract IndexerModuleV2Test is Test {
  using ECDSA for bytes32;

  IndexerModuleV2 private indexerModule;
  AttestationPayload private attestationPayload;
  PortalRegistryMock private portalRegistry;
  AttestationRegistryMock private attestationRegistry;
  SchemaRegistryMock private schemaRegistry;
  Router private router;

  address private user = makeAddr("user");
  address private portal = makeAddr("portal");
  address private portalOwner = makeAddr("portalOwner");
  address private moduleRegistry = makeAddr("moduleRegistry");
  address private attester = makeAddr("attester");

  AttestationPayload private payload1;
  AttestationPayload private payload2;
  AttestationPayload private payload3;

  event AttestationIndexed(bytes32 attestationId);

  function setUp() public {
    vm.startPrank(portalOwner);
    // add portal to mock registry
    portalRegistry = new PortalRegistryMock();
    portalRegistry.register(address(portal), "portal", "portal", false, "portal");

    attestationRegistry = new AttestationRegistryMock();

    router = new Router();
    router.initialize();
    router.updatePortalRegistry(address(portalRegistry));
    router.updateAttestationRegistry(address(attestationRegistry));
    router.updateSchemaRegistry(address(schemaRegistry));

    payload1 = AttestationPayload(bytes32("1"), 0, bytes(""), bytes(""));
    payload2 = AttestationPayload(bytes32("1"), 0, bytes(""), bytes(""));
    payload3 = AttestationPayload(bytes32("2"), 0, bytes(""), bytes(""));

    attestationRegistry.attest(payload1, user);
    attestationRegistry.attest(payload2, user);

    indexerModule = new IndexerModuleV2(address(attestationRegistry), address(portalRegistry), moduleRegistry);

    indexerModule.indexAttestation(bytes32(abi.encode(1)));

    vm.stopPrank();
  }

  function test_constructor() public view {
    assertEq(address(indexerModule.attestationRegistry()), address(attestationRegistry));
    assertEq(address(indexerModule.portalRegistry()), address(portalRegistry));
    assertEq(indexerModule.moduleRegistry(), moduleRegistry);
  }

  function test_run() public {
    bytes32 expectedAttestationId = attestationRegistry.getNextAttestationId();
    vm.prank(moduleRegistry);
    vm.expectEmit({ emitter: address(indexerModule) });
    emit AttestationIndexed(expectedAttestationId);
    indexerModule.run(payload3, bytes(""), address(0), 0, attester, portal, OperationType.Attest);

    assertEq(indexerModule.getIndexedAttestationStatus(expectedAttestationId), true);
    assertEq(indexerModule.getAttestationIdsBySubject(payload3.subject)[1], expectedAttestationId);
    assertEq(
      indexerModule.getAttestationIdsBySubjectBySchema(payload3.subject, payload3.schemaId)[0],
      expectedAttestationId
    );
    assertEq(indexerModule.getAttestationIdsByAttester(attester)[0], expectedAttestationId);
    assertEq(indexerModule.getAttestationIdsBySchema(payload3.schemaId)[0], expectedAttestationId);
    assertEq(indexerModule.getAttestationIdsByPortal(portal)[0], expectedAttestationId);
    assertEq(indexerModule.getAttestationIdsByPortalBySubject(portal, payload3.subject)[0], expectedAttestationId);
  }

  function test_run_OnlyModuleRegistry() public {
    bytes32 expectedAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(user);
    vm.expectRevert(IndexerModuleV2.OnlyModuleRegistry.selector);
    indexerModule.run(payload3, bytes(""), address(0), 0, attester, portal, OperationType.Attest);

    vm.prank(portal);
    vm.expectRevert(IndexerModuleV2.OnlyModuleRegistry.selector);
    indexerModule.run(payload3, bytes(""), address(0), 0, attester, portal, OperationType.Attest);

    assertEq(indexerModule.getIndexedAttestationStatus(expectedAttestationId), false);
  }

  function test_run_OnlyRegisteredPortal() public {
    bytes32 expectedAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(moduleRegistry);
    vm.expectRevert(IndexerModuleV2.OnlyRegisteredPortal.selector);
    indexerModule.run(payload3, bytes(""), address(0), 0, attester, user, OperationType.Attest);

    assertEq(indexerModule.getIndexedAttestationStatus(expectedAttestationId), false);
  }

  function test_indexAttestation() public {
    vm.expectEmit({ emitter: address(indexerModule) });
    emit AttestationIndexed(bytes32(abi.encode(2)));
    indexerModule.indexAttestation(bytes32(abi.encode(2)));
  }

  function test_indexAttestations() public {
    bytes32[] memory attestationIds = new bytes32[](2);
    attestationIds[0] = bytes32(abi.encode(1));
    attestationIds[1] = bytes32(abi.encode(2));
    indexerModule.indexAttestations(attestationIds);
    assertEq(indexerModule.getIndexedAttestationStatus(attestationIds[0]), true);
    assertEq(indexerModule.getIndexedAttestationStatus(attestationIds[1]), true);
  }

  function test_indexAttestation_CannotBeIndexedTwice() public {
    vm.expectEmit({ emitter: address(indexerModule) });
    emit AttestationIndexed(bytes32(abi.encode(2)));
    indexerModule.indexAttestation(bytes32(abi.encode(2)));
    indexerModule.indexAttestation(bytes32(abi.encode(2)));

    bytes32[] memory attestationIds = indexerModule.getAttestationIdsBySubject(payload1.subject);
    assertEq(attestationIds.length, 2);
  }

  function test_getAttestationIdsBySubject() public view {
    bytes32[] memory attestationIds = indexerModule.getAttestationIdsBySubject(payload1.subject);
    assertEq(attestationIds[0], bytes32(abi.encode(1)));
  }

  function test_getAttestationIdsBySubjectBySchema() public view {
    bytes32[] memory attestationIds = indexerModule.getAttestationIdsBySubjectBySchema(
      payload1.subject,
      payload1.schemaId
    );
    assertEq(attestationIds[0], bytes32(abi.encode(1)));
  }

  function test_getAttestationIdsByAttester() public view {
    bytes32[] memory attestationIds = indexerModule.getAttestationIdsByAttester(user);
    assertEq(attestationIds[0], bytes32(abi.encode(1)));
  }

  function test_getAttestationIdsBySchema() public view {
    bytes32[] memory attestationIds = indexerModule.getAttestationIdsBySchema(payload1.schemaId);
    assertEq(attestationIds[0], bytes32(abi.encode(1)));
  }

  function test_getAttestationIdsByPortal() public view {
    bytes32[] memory attestationIds = indexerModule.getAttestationIdsByPortal(portalOwner);
    assertEq(attestationIds[0], bytes32(abi.encode(1)));
  }

  function test_getAttestationByPortalBySubject() public view {
    bytes32[] memory attestationIds = indexerModule.getAttestationIdsByPortalBySubject(portalOwner, payload1.subject);
    assertEq(attestationIds[0], bytes32(abi.encode(1)));
  }

  function test_getIndexedAttestationStatus() public view {
    bool status = indexerModule.getIndexedAttestationStatus(bytes32(abi.encode(1)));
    assertEq(status, true);
  }
}
