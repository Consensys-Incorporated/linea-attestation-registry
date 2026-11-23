// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { Test, Vm } from "forge-std/Test.sol";
import { Router } from "../../src/Router.sol";
import { AttestationPayload } from "../../src/types/Structs.sol";
import { AttestationRegistry } from "../../src/AttestationRegistry.sol";
import { ModuleRegistry } from "../../src/ModuleRegistry.sol";
import { SchemaRegistry } from "../../src/SchemaRegistry.sol";
import { PortalRegistry } from "../../src/PortalRegistry.sol";
import { ERC1271ModuleV2 } from "../../src/stdlib/ERC1271ModuleV2.sol";
import { DefaultPortalV2 } from "../../src/DefaultPortalV2.sol";
import { ERC1271WalletMock } from "../mocks/ERC1271WalletMock.sol";
import { TransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

contract ERC1271ModuleIntegrationTest is Test {
  address public issuerAddress = makeAddr("issuer");
  address public user = makeAddr("user");
  address public walletOwner;
  uint256 public walletOwnerPk;
  address public eoaSigner;
  uint256 public eoaSignerPk;
  Router public router = new Router();
  SchemaRegistry public schemaRegistry;
  PortalRegistry public portalRegistry;
  ModuleRegistry public moduleRegistry;
  AttestationRegistry public attestationRegistry;
  ERC1271ModuleV2 public erc1271Module;
  ERC1271WalletMock public wallet;
  DefaultPortalV2 public portal;
  bytes32 public schemaId;

  function setUp() public {
    (walletOwner, walletOwnerPk) = makeAddrAndKey("walletOwner");
    (eoaSigner, eoaSignerPk) = makeAddrAndKey("eoaSigner");
    wallet = new ERC1271WalletMock(walletOwner);

    router.initialize();
    _deployRegistries();

    erc1271Module = new ERC1271ModuleV2(address(portalRegistry));
    portalRegistry.setIssuer(issuerAddress);

    vm.startPrank(issuerAddress);
    moduleRegistry.register("ERC1271Module", "ERC1271Module description", address(erc1271Module));

    schemaId = schemaRegistry.getIdFromSchemaString("(bool isBuidler)");
    schemaRegistry.createSchema("Buidler", "Describes a buidler", "https://schema.org/Property", "(bool isBuidler)");

    address[] memory modules = new address[](1);
    modules[0] = address(erc1271Module);

    vm.recordLogs();
    portalRegistry.deployDefaultPortal(modules, "SignedPortal", "SignedPortal description", true, "Verax");
    Vm.Log[] memory entries = vm.getRecordedLogs();
    (, , address portalAddress) = abi.decode(entries[0].data, (string, string, address));
    portal = DefaultPortalV2(portalAddress);

    address[] memory signers = new address[](2);
    signers[0] = address(wallet);
    signers[1] = eoaSigner;
    bool[] memory statuses = new bool[](2);
    statuses[0] = true;
    statuses[1] = true;
    erc1271Module.setAuthorizedSigners(address(portal), signers, statuses);
    vm.stopPrank();
  }

  function test_attest_ContractSigner() public {
    AttestationPayload memory payload = _payload(user);
    bytes32 expectedAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(user);
    portal.attest(payload, _validationPayloads(address(wallet), walletOwnerPk, payload));

    assertTrue(attestationRegistry.isRegistered(expectedAttestationId));
  }

  function test_attest_EOASigner() public {
    AttestationPayload memory payload = _payload(user);
    bytes32 expectedAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(user);
    portal.attest(payload, _validationPayloads(eoaSigner, eoaSignerPk, payload));

    assertTrue(attestationRegistry.isRegistered(expectedAttestationId));
  }

  function test_bulkAttest_ContractSigner() public {
    AttestationPayload[] memory payloads = new AttestationPayload[](2);
    payloads[0] = _payload(user);
    payloads[1] = _payload(issuerAddress);
    bytes[][] memory validationPayloads = new bytes[][](2);
    validationPayloads[0] = _validationPayloads(address(wallet), walletOwnerPk, payloads[0]);
    validationPayloads[1] = _validationPayloads(address(wallet), walletOwnerPk, payloads[1]);
    bytes32 firstAttestationId = attestationRegistry.getNextAttestationId();

    vm.prank(user);
    portal.bulkAttest(payloads, validationPayloads);

    assertTrue(attestationRegistry.isRegistered(firstAttestationId));
    assertEq(attestationRegistry.getAttestationIdCounter(), 2);
  }

  function test_attest_SignerNotAuthorized() public {
    AttestationPayload memory payload = _payload(user);
    bytes[] memory validationPayloads = _validationPayloads(walletOwner, walletOwnerPk, payload);

    // The owner of an authorized wallet is not an authorized signer himself
    vm.prank(user);
    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    portal.attest(payload, validationPayloads);

    assertEq(attestationRegistry.getAttestationIdCounter(), 0);
  }

  function test_attest_InvalidSignature() public {
    AttestationPayload memory payload = _payload(user);
    bytes[] memory validationPayloads = _validationPayloads(address(wallet), eoaSignerPk, payload);

    vm.prank(user);
    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    portal.attest(payload, validationPayloads);

    assertEq(attestationRegistry.getAttestationIdCounter(), 0);
  }

  function test_attest_InvalidSignature_AnotherPayload() public {
    bytes[] memory validationPayloads = _validationPayloads(address(wallet), walletOwnerPk, _payload(user));

    vm.prank(user);
    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    portal.attest(_payload(issuerAddress), validationPayloads);

    assertEq(attestationRegistry.getAttestationIdCounter(), 0);
  }

  function _deployRegistries() private {
    address proxyAdmin = makeAddr("proxyAdmin");

    attestationRegistry = AttestationRegistry(
      _proxy(
        address(new AttestationRegistry()),
        proxyAdmin,
        abi.encodeWithSelector(AttestationRegistry.initialize.selector, address(router), uint256(0))
      )
    );
    router.updateAttestationRegistry(address(attestationRegistry));

    portalRegistry = PortalRegistry(
      _proxy(
        address(new PortalRegistry()),
        proxyAdmin,
        abi.encodeWithSelector(PortalRegistry.initialize.selector, address(router), false)
      )
    );
    router.updatePortalRegistry(address(portalRegistry));

    schemaRegistry = SchemaRegistry(
      _proxy(
        address(new SchemaRegistry()),
        proxyAdmin,
        abi.encodeWithSelector(SchemaRegistry.initialize.selector, address(router))
      )
    );
    router.updateSchemaRegistry(address(schemaRegistry));

    moduleRegistry = ModuleRegistry(
      _proxy(
        address(new ModuleRegistry()),
        proxyAdmin,
        abi.encodeWithSelector(ModuleRegistry.initialize.selector, address(router))
      )
    );
    router.updateModuleRegistry(address(moduleRegistry));
  }

  function _proxy(address implementation, address admin, bytes memory data) private returns (address) {
    return address(new TransparentUpgradeableProxy(implementation, admin, data));
  }

  function _payload(address subject) private view returns (AttestationPayload memory) {
    return AttestationPayload(schemaId, 0, abi.encode(subject), abi.encode(true));
  }

  function _validationPayloads(
    address signer,
    uint256 privateKey,
    AttestationPayload memory payload
  ) private pure returns (bytes[] memory validationPayloads) {
    bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encode(payload))));
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
    validationPayloads = new bytes[](1);
    validationPayloads[0] = abi.encode(signer, abi.encodePacked(r, s, v));
  }
}
