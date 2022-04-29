
/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./ConvertDeposit.sol";

/**
 * @author Publius
 * @title Convert Withdraw
**/
contract ConvertWithdraw is ConvertDeposit {

    using SafeMath for uint256;
    using LibSafeMath32 for uint32;

    event LPRemove(address indexed account, uint32[] crates, uint256[] crateLP, uint256 lp);
    event BeanRemove(address indexed account, uint32[] crates, uint256[] crateBeans, uint256 beans);
    event RemoveSeasons(address indexed account, address indexed token, uint32[] seasons, uint256[] amounts, uint256 amount);

    struct AssetsRemoved {
        uint256 tokensRemoved;
        uint256 stalkRemoved;
        uint256 bdvRemoved;
    }

    function _withdrawForConvert(
        address token,
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxTokens
    ) internal returns (uint256 grownStalkRemoved) {
        require(seasons.length == amounts.length, "Convert: seasons, amounts are diff lengths.");
        AssetsRemoved memory a = _removeTokensForConvert(token, seasons, amounts, maxTokens);
        require(a.tokensRemoved == maxTokens, "Convert: Not enough tokens removed.");
        a.stalkRemoved = a.stalkRemoved.mul(s.ss[token].seeds);
        LibTokenSilo.decrementDepositedToken(token, a.tokensRemoved);
        LibSilo.withdrawSiloAssets(
            msg.sender, 
            a.bdvRemoved.mul(s.ss[token].seeds), 
            a.stalkRemoved.add(a.bdvRemoved.mul(s.ss[token].stalk))
        );
        return a.stalkRemoved;
    }
    
    function _removeTokensForConvert(
        address token,
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxTokens
    ) 
        internal
        returns (AssetsRemoved memory a)
    {
        uint256 depositBDV;
        uint256 i = 0;
        while ((i < seasons.length) && (a.tokensRemoved < maxTokens)) {
            if (a.tokensRemoved.add(amounts[i]) < maxTokens)
                depositBDV = LibTokenSilo.removeDeposit(msg.sender, token, seasons[i], amounts[i]);
            else {
                amounts[i] = maxTokens.sub(a.tokensRemoved);
                depositBDV = LibTokenSilo.removeDeposit(msg.sender, token, seasons[i], amounts[i]);
            }
            a.tokensRemoved = a.tokensRemoved.add(amounts[i]);
            a.bdvRemoved = a.bdvRemoved.add(depositBDV);
            a.stalkRemoved = a.stalkRemoved.add(depositBDV.mul(season()-seasons[i]));
            i++;
        }
        while (i < seasons.length) {
            amounts[i] = 0;
            i++;
        }
        emit RemoveSeasons(msg.sender, token, seasons, amounts, a.tokensRemoved);
        return a;
    }
}
