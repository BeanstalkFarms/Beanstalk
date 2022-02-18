// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;


library LibConvertUserData {
    // In order to preserve backwards compatibility, make sure new kinds are added at the end of the enum.
    enum ExitKind {
        EXACT_CURVE_LP_OUT_IN_BEANS,
        UNISWAP_REMOVE_BEAN_AND_BUY_LP // for ManagedPool
    }

    enum DepositKind {
        CURVE_ADD_LP,
        UNISWAP_ADD_LP
    }

    function exitKind(bytes memory self) internal pure returns (ExitKind) {
        return abi.decode(self, (ExitKind));
    }

    function depositKind(bytes memory self) internal pure returns (DepositKind) {
        return abi.decode(self, (DepositKind));
    }

    // SellToPegAndAddLiquidity Functions

    function initialAmountsIn(bytes memory self) internal pure returns (uint256[] memory amountsIn) {
        (, amountsIn) = abi.decode(self, (DepositKind, uint256[]));
    }

    function exactCurveLPOutInBeans(bytes memory self)
        internal
        pure
        returns (uint256 minLPAmountOut)
    {
        (, minLPAmountOut) = abi.decode(self, (ExitKind, uint256));
    }

    function tokenInForExactBptOut(bytes memory self) internal pure returns (uint256 bptAmountOut, uint256 tokenIndex) {
        (, bptAmountOut, tokenIndex) = abi.decode(self, (DepositKind, uint256, uint256));
    }

}
