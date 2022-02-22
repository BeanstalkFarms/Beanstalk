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
    enum BuyToPegKind {
        EXACT_UNISWAP_REMOVE_BEAN_AND_ADD_LP,
        EXACT_CURVE_LP_OUT_IN_BEANS
    }

    enum SellToPegKind {
        EXACT_UNISWAP_SELL_BEANS_AND_ADD_LP,
        EXACT_CURVE_ADD_LP_IN_BEANS
    }

    function buyToPegKind(bytes memory self) internal pure returns (BuyToPegKind) {
        return abi.decode(self, (BuyToPegKind));
    }

    function sellToPegKind(bytes memory self) internal pure returns (SellToPegKind) {
        return abi.decode(self, (SellToPegKind));
    }

    // SellToPegAndAddLiquidity Functions

    function exactCurveAddLPInBeans(bytes memory self)
        internal
        pure
        returns (uint256 beans, uint256 minLP)
    {
        (, beans, minLP) = abi.decode(self, (SellToPegKind, uint256, uint256));
    }

    function exactUniswapSellBeansAndAddLP(bytes memory self)
        internal
        pure
        returns (uint256 beans, uint256 minLP)
    {
        (, beans, minLP) = abi.decode(self, (SellToPegKind, uint256, uint256));
    }

    // BuyToPeg Functions
    function exactCurveLPOutInBeans(bytes memory self)
        internal
        pure
        returns (uint256 minLPAmountOut)
    {
        (, minLPAmountOut) = abi.decode(self, (BuyToPegKind, uint256));
    }

    function exactUniswapBeansOutInLP(bytes memory self)
        internal
        pure
        returns (uint256 lp, uint256 minBeans)
    {
        (, lp, minBeans) = abi.decode(self, (BuyToPegKind, uint256, uint256));
    }

    function tokenInForExactBptOut(bytes memory self) internal pure returns (uint256 bptAmountOut, uint256 tokenIndex) {
        (, bptAmountOut, tokenIndex) = abi.decode(self, (SellToPegKind, uint256, uint256));
    }

}
