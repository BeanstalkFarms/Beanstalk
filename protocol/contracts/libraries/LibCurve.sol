/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import '../interfaces/IMeta3Curve.sol';
import '../interfaces/IBean3Curve.sol';

/* 
 * Author: Beasley
 * LibCurve is the "router" for the Curve Pools
*/

library LibCurve {

	address private constant BEAN3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
	address private constant METACRV = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
}
