// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { AbstractModuleV2 } from "../abstracts/AbstractModuleV2.sol";
import { PortalRegistry } from "../PortalRegistry.sol";
import { OperationType } from "../types/Enums.sol";
import { AttestationPayload } from "../types/Structs.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { SignatureChecker } from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/**
 * @title ERC-1271 Module V2
 * @author Consensys
 * @notice This Module can be used by Portal creators to
 *         require a signature of the attestation payload
 *         from an authorized signer before issuing the attestation.
 *         The signer can be an EOA (ECDSA) or a smart contract wallet (ERC-1271).
 * @dev DISCLAIMER: This module doesn't check that a signature can be used only once!
 */
contract ERC1271ModuleV2 is AbstractModuleV2 {
  using ECDSA for bytes32;

  PortalRegistry public portalRegistry;

  mapping(address portal => mapping(address signer => bool authorizedSigners)) public authorizedSigners;

  /// @notice Error thrown when an array length mismatch occurs
  error ArrayLengthMismatch();
  /// @notice Error thrown when a signer is not authorized by the module
  error SignerNotAuthorized();
  /// @notice Error thrown when a signature is invalid
  error InvalidSignature();

  /// @notice Event emitted when the authorized signers are set
  event SignersAuthorized(address indexed portal, address[] signers, bool[] authorizationStatus);

  modifier onlyPortalOwner(address portal) {
    if (msg.sender != portalRegistry.getPortalOwner(portal)) revert OnlyPortalOwner();
    _;
  }

  /**
   * @notice Contract constructor sets the portal registry
   */
  constructor(address _portalRegistry) {
    portalRegistry = PortalRegistry(_portalRegistry);
  }

  /**
   * @notice Set the accepted status of schemaIds
   * @param signers The signers to be set
   * @param authorizationStatus The authorization status of signers
   * @dev The length of `signers` and `authorizationStatus` must be the same
   */
  function setAuthorizedSigners(
    address portal,
    address[] calldata signers,
    bool[] calldata authorizationStatus
  ) public onlyPortalOwner(portal) {
    if (signers.length != authorizationStatus.length) revert ArrayLengthMismatch();

    for (uint256 i = 0; i < signers.length; i++) {
      authorizedSigners[portal][signers[i]] = authorizationStatus[i];
    }

    emit SignersAuthorized(portal, signers, authorizationStatus);
  }

  /**
   * @inheritdoc AbstractModuleV2
   * @param attestationPayload The Payload of the attestation
   * @param validationPayload The validation payload required for the module: `abi.encode(address signer, bytes signature)`
   * @param portal The Portal issuing the attestation
   * @notice If the signer is not authorized, or if its signature of the payload is not valid, an error is thrown
   * @dev A contract signer cannot be recovered from its signature, so the payload must name the signer
   */
  function run(
    AttestationPayload calldata attestationPayload,
    bytes calldata validationPayload,
    address /*initialCaller*/,
    uint256 /*value*/,
    address /*attester*/,
    address portal,
    OperationType /*operationType*/
  ) public view override {
    (address signer, bytes memory signature) = abi.decode(validationPayload, (address, bytes));
    if (!authorizedSigners[portal][signer]) revert SignerNotAuthorized();

    bytes32 messageHash = keccak256(abi.encode(attestationPayload)).toEthSignedMessageHash();
    if (!SignatureChecker.isValidSignatureNow(signer, messageHash, signature)) revert InvalidSignature();
  }
}
