// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import { IERC1271 } from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/// @dev Contract wallet that reverts on each signature check
contract ERC1271RevertingWalletMock is IERC1271 {
  error WalletLocked();

  function test() public {}

  function isValidSignature(bytes32, bytes memory) external pure override returns (bytes4) {
    revert WalletLocked();
  }
}
