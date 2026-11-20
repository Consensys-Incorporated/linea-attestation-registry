// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @dev Minimal single-owner contract wallet, valid for the signatures of its owner
contract ERC1271WalletMock is IERC1271 {
  address public owner;

  constructor(address _owner) {
    owner = _owner;
  }

  function test() public {}

  function isValidSignature(bytes32 hash, bytes memory signature) external view override returns (bytes4) {
    (address recovered, ECDSA.RecoverError error) = ECDSA.tryRecover(hash, signature);
    if (error == ECDSA.RecoverError.NoError && recovered == owner) return IERC1271.isValidSignature.selector;
    return 0xffffffff;
  }
}
