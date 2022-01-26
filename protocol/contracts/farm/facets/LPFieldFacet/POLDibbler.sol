/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../../interfaces/IBean.sol";
import "../../../libraries/LibDibbler.sol";
// import "../FieldFacet/BeanDibbler.sol";

/**
 * @author Publius
 * @title LPField sows LP.
**/
contract POLDibbler {

    using SafeMath for uint256;
    using SafeMath for uint32;
    using Decimal for Decimal.D256;

    event Sow(address indexed account, uint256 index, uint256 beans, uint256 pods);
    event AddPOL(address indexed account, address indexed token, uint256 amount);

    AppStorage internal s;
    uint32 private constant MAX_UINT32 = 2**32-1;
    /**
     * Sow
    **/

    function _sowPOL(uint256 amount, uint256 value) internal returns (uint256 pods) {
        require(intPrice() > 0, "POLField: Price < 1.");
        pods = LibDibbler.sow(value, msg.sender);
        bean().burn(value);
        LibCheck.beanBalanceCheck();
        return pods;
        emit AddPOL(msg.sender, s.c.pair, amount);
    }

    function intPrice() public view returns (uint256) {
        (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(s.c.pair).getReserves();
        (uint256 beanReserve, uint256 ethReserve) = s.index == 0 ? (reserve0, reserve1) : (reserve1, reserve0);     
        (uint256 usdcReserve, uint256 ethUsdcReserve,) = IUniswapV2Pair(s.c.pegPair).getReserves(); 

        return ethReserve.mul(usdcReserve).div(beanReserve).div(ethUsdcReserve);
    }

    /**
     * Getters
     */

     function pair() internal view returns (IUniswapV2Pair) {
        return IUniswapV2Pair(s.c.pair);
    }

    function bean() internal view returns (IBean) {
        return IBean(s.c.bean);
    }
}
