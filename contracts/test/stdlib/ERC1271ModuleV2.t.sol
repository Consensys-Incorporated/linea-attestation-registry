// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { Test } from "forge-std/Test.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

import { ERC1271ModuleV2, AbstractModuleV2 } from "../../src/stdlib/ERC1271ModuleV2.sol";
import { OperationType } from "../../src/types/Enums.sol";
import { AttestationPayload } from "../../src/types/Structs.sol";
import { PortalRegistryMock } from "../mocks/PortalRegistryMock.sol";
import { ERC1271WalletMock } from "../mocks/ERC1271WalletMock.sol";
import { ERC1271RevertingWalletMock } from "../mocks/ERC1271RevertingWalletMock.sol";

contract ERC1271ModuleV2Test is Test {
  using ECDSA for bytes32;

  ERC1271ModuleV2 private erc1271Module;
  address private signer1;
  uint256 private signerPk1;
  address private signer2;
  uint256 private signerPk2;
  address private portal = makeAddr("portal");
  address private otherPortal = makeAddr("otherPortal");
  address private attester = makeAddr("attester");
  AttestationPayload private attestationPayload;
  ERC1271WalletMock private wallet;
  PortalRegistryMock private portalRegistry;

  address private portalOwner = makeAddr("portalOwner");
  address private user = makeAddr("user");
  address[] private signers = new address[](2);
  bool[] private authorizationStatus = new bool[](2);

  event SignersAuthorized(address indexed portal, address[] signers, bool[] authorizationStatus);

  function setUp() public {
    (signer1, signerPk1) = makeAddrAndKey("signer1");
    (signer2, signerPk2) = makeAddrAndKey("signer2");

    signers[0] = signer1;
    signers[1] = signer2;

    authorizationStatus[0] = true;
    authorizationStatus[1] = false;

    vm.startPrank(portalOwner);
    // add portal to mock registry
    portalRegistry = new PortalRegistryMock();
    portalRegistry.register(address(portal), "portal", "portal", false, "portal");
    portalRegistry.register(address(otherPortal), "otherPortal", "otherPortal", false, "otherPortal");

    erc1271Module = new ERC1271ModuleV2(address(portalRegistry));
    vm.stopPrank();

    // Contract wallet owned by signer2, who is not an authorized signer himself
    wallet = new ERC1271WalletMock(signer2);
    attestationPayload = AttestationPayload(bytes32(uint256(1234)), 0, abi.encode(user), "");
  }

  function test_setAuthorizedSigners() public {
    vm.prank(portalOwner);
    vm.expectEmit({ emitter: address(erc1271Module) });
    emit SignersAuthorized(portal, signers, authorizationStatus);
    erc1271Module.setAuthorizedSigners(address(portal), signers, authorizationStatus);
  }

  function test_setAuthorizedSigners_OnlyPortalOwner() public {
    vm.prank(user);
    vm.expectRevert(AbstractModuleV2.OnlyPortalOwner.selector);
    erc1271Module.setAuthorizedSigners(address(portal), signers, authorizationStatus);
  }

  function test_setAuthorizedSigners_ArrayLengthMismatch() public {
    vm.prank(portalOwner);
    vm.expectRevert(ERC1271ModuleV2.ArrayLengthMismatch.selector);
    erc1271Module.setAuthorizedSigners(address(portal), signers, new bool[](1));
  }

  function test_run_EOASigner() public {
    _authorizeSigners();

    _run(portal, attestationPayload, abi.encode(signer1, _sign(signerPk1, attestationPayload)));
  }

  function test_run_ContractSigner() public {
    _authorize(portal, address(wallet), true);

    _run(portal, attestationPayload, abi.encode(address(wallet), _sign(signerPk2, attestationPayload)));
  }

  function test_run_SignerNotAuthorized() public {
    _authorizeSigners();

    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    _run(portal, attestationPayload, abi.encode(signer2, _sign(signerPk2, attestationPayload)));
  }

  function test_run_SignerNotAuthorized_ContractSigner() public {
    _authorizeSigners();

    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    _run(portal, attestationPayload, abi.encode(address(wallet), _sign(signerPk2, attestationPayload)));
  }

  function test_run_SignerNotAuthorized_WalletOwnerIsNotTheSigner() public {
    _authorize(portal, address(wallet), true);

    // The wallet is authorized, its owner is not
    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    _run(portal, attestationPayload, abi.encode(signer2, _sign(signerPk2, attestationPayload)));
  }

  function test_run_SignerNotAuthorized_AuthorizedOnAnotherPortal() public {
    _authorize(otherPortal, signer1, true);
    _authorize(otherPortal, address(wallet), true);

    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    _run(portal, attestationPayload, abi.encode(signer1, _sign(signerPk1, attestationPayload)));

    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    _run(portal, attestationPayload, abi.encode(address(wallet), _sign(signerPk2, attestationPayload)));
  }

  function test_run_SignerNotAuthorized_AfterRevocation() public {
    _authorize(portal, address(wallet), true);
    bytes memory validationPayload = abi.encode(address(wallet), _sign(signerPk2, attestationPayload));
    _run(portal, attestationPayload, validationPayload);

    _authorize(portal, address(wallet), false);

    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    _run(portal, attestationPayload, validationPayload);
  }

  function test_run_InvalidSignature_EOASigner() public {
    _authorizeSigners();

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(signer1, _sign(signerPk2, attestationPayload)));
  }

  function test_run_InvalidSignature_ContractSigner() public {
    _authorize(portal, address(wallet), true);

    // signer1 is not the owner of the wallet
    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(address(wallet), _sign(signerPk1, attestationPayload)));
  }

  function test_run_InvalidSignature_AnotherPayload() public {
    _authorizeSigners();
    _authorize(portal, address(wallet), true);
    AttestationPayload memory otherPayload = AttestationPayload(bytes32(uint256(1234)), 0, abi.encode(portalOwner), "");

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(signer1, _sign(signerPk1, otherPayload)));

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(address(wallet), _sign(signerPk2, otherPayload)));
  }

  function test_run_InvalidSignature_MalformedSignature() public {
    _authorizeSigners();
    _authorize(portal, address(wallet), true);

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(signer1, bytes("")));

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(address(wallet), bytes("")));
  }

  function test_run_InvalidSignature_RevertingContractSigner() public {
    ERC1271RevertingWalletMock revertingWallet = new ERC1271RevertingWalletMock();
    _authorize(portal, address(revertingWallet), true);

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(address(revertingWallet), _sign(signerPk2, attestationPayload)));
  }

  function test_run_InvalidSignature_ContractSignerWithoutERC1271() public {
    // The PortalRegistry mock is a contract that does not implement ERC-1271
    _authorize(portal, address(portalRegistry), true);

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(address(portalRegistry), _sign(signerPk2, attestationPayload)));
  }

  function test_run_RawSignatureIsNotAValidationPayload() public {
    _authorizeSigners();

    // A raw signature, without the signer, cannot be decoded
    vm.expectRevert();
    _run(portal, attestationPayload, _sign(signerPk1, attestationPayload));
  }

  function testFuzz_run_SignerNotAuthorized(address signer, bytes calldata signature) public {
    vm.assume(signer != signer1);
    _authorizeSigners();

    vm.expectRevert(ERC1271ModuleV2.SignerNotAuthorized.selector);
    _run(portal, attestationPayload, abi.encode(signer, signature));
  }

  function testFuzz_run_InvalidSignature(bytes calldata signature) public {
    _authorizeSigners();
    _authorize(portal, address(wallet), true);
    vm.assume(keccak256(signature) != keccak256(_sign(signerPk1, attestationPayload)));
    vm.assume(keccak256(signature) != keccak256(_sign(signerPk2, attestationPayload)));

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(signer1, signature));

    vm.expectRevert(ERC1271ModuleV2.InvalidSignature.selector);
    _run(portal, attestationPayload, abi.encode(address(wallet), signature));
  }

  function _authorizeSigners() private {
    vm.prank(portalOwner);
    erc1271Module.setAuthorizedSigners(portal, signers, authorizationStatus);
  }

  function _authorize(address targetPortal, address signer, bool status) private {
    address[] memory newSigners = new address[](1);
    newSigners[0] = signer;
    bool[] memory newStatus = new bool[](1);
    newStatus[0] = status;

    vm.prank(portalOwner);
    erc1271Module.setAuthorizedSigners(targetPortal, newSigners, newStatus);
  }

  function _run(address targetPortal, AttestationPayload memory payload, bytes memory validationPayload) private view {
    erc1271Module.run(payload, validationPayload, user, 0, attester, targetPortal, OperationType.Attest);
  }

  function _sign(uint256 privateKey, AttestationPayload memory payload) private pure returns (bytes memory) {
    (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, createMessageHash(payload));
    return abi.encodePacked(r, s, v);
  }

  function createMessageHash(AttestationPayload memory payload) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encode(payload))));
  }
}
