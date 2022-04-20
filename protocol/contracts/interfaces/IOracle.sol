/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../libraries/Decimal.sol";

/**
 * @author Publius
 * @title Oracle Interface
**/
interface IOracle {

  function capture() external returns (int256);

}
