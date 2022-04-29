
/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";
import "../../../libraries/LibInternal.sol";
import "../../../libraries/LibSafeMath32.sol";
import "../../../C.sol";
import "../../ReentrancyGuard.sol";

/**
 * @author Publius
 * @title Bean Silo
**/
contract ConvertDeposit is ReentrancyGuard {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;
    
    struct WithdrawState {
        uint256 newLP;
        uint256 beansAdded;
        uint256 beansTransferred;
        uint256 beansRemoved;
        uint256 stalkRemoved;
        uint256 i;
    }

    /**
     * Internal LP
    **/

    function _depositTokens(address token, uint256 amount, uint256 bdv, uint256 grownStalk) internal {
        require(bdv > 0 && amount > 0, "Convert: BDV or amount is 0.");
        
        uint256 seeds = bdv.mul(LibTokenSilo.seeds(token));
        uint32 _s;
        if (grownStalk > 0) {
            _s = uint32(grownStalk.div(seeds));
            uint32 __s = season();
            if (_s >= __s) _s = __s - 1;
            grownStalk = uint256(_s).mul(seeds);
            _s = __s - _s;
        } else _s = season();
        uint256 stalk = bdv.mul(LibTokenSilo.stalk(token)).add(grownStalk);
        LibSilo.depositSiloAssets(msg.sender, seeds, stalk);

        LibTokenSilo.incrementDepositedToken(token, amount);
        LibTokenSilo.addDeposit(msg.sender, token, _s, amount, bdv);
    }

    function season() internal view returns (uint32) {
        return s.season.current;
    }
}
