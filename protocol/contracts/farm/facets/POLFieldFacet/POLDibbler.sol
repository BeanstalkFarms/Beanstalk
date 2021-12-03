/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../FieldFacet/Dibbler.sol";

/**
 * @author Publius
 * @title LPField sows LP.
**/
contract POLDibbler is Dibbler {

    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    event AddPOL(address indexed account, address indexed token, uint256 amount);

    /**
     * Sow
    **/

    function _sowPOL(uint256 amount, uint256 value) internal returns (uint256) {
        require(intPrice() > 0, "POLField: Price < 1.");
        return _sow(value, msg.sender);
        emit AddPOL(msg.sender, s.c.pair, amount);
    }

    function intPrice() public view returns (uint256) {
        (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();
        (uint256 beanReserve, uint256 ethReserve) = s.index == 0 ? (reserve0, reserve1) : (reserve1, reserve0);     
        (uint256 usdcReserve, uint256 ethUsdcReserve,) = IUniswapV2Pair(s.c.pegPair).getReserves(); 

        return ethReserve.mul(usdcReserve).div(beanReserve).div(ethUsdcReserve);
    }

    function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

}
