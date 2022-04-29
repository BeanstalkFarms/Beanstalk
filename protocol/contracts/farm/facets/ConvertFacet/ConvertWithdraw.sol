
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
        if (token == s.c.bean) return _withdrawBeansForConvert(seasons, amounts, maxTokens);
        else if (token == s.c.pair) return _withdrawLPForConvert(seasons, amounts, maxTokens);
        return _withdrawTokensForConvert(token, seasons, amounts, maxTokens);
    }

    function _withdrawTokensForConvert(
        address token,
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxTokens
    )
        internal
        returns (uint256 grownStalkRemoved)
    {
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
        uint256 depositTokens; uint256 depositBDV;
        uint256 i = 0;
        while ((i < seasons.length) && (a.tokensRemoved < maxTokens)) {
            if (a.tokensRemoved.add(amounts[i]) < maxTokens)
                (depositTokens, depositBDV) = LibTokenSilo.removeDeposit(msg.sender, token, seasons[i], amounts[i]);
            else
                (depositTokens, depositBDV) = LibTokenSilo.removeDeposit(msg.sender, token, seasons[i], maxTokens.sub(a.tokensRemoved));
            a.tokensRemoved = a.tokensRemoved.add(depositTokens);
            a.bdvRemoved = a.bdvRemoved.add(depositBDV);
            a.stalkRemoved = a.stalkRemoved.add(depositBDV.mul(season()-seasons[i]));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositTokens;
        while (i < seasons.length) {
            amounts[i] = 0;
            i++;
        }
        emit RemoveSeasons(msg.sender, token, seasons, amounts, a.tokensRemoved);
        return a;
    }

    function _withdrawLPForConvert(
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxLP
    )
        internal
        returns (uint256 stalkRemoved)
    {
        uint256 seedsRemoved;
        uint256 lpRemoved;
        uint256 depositLP;
        uint256 depositSeeds;
        uint256 i = 0;
        while ((i < seasons.length) && (lpRemoved < maxLP)) {
            if (lpRemoved.add(amounts[i]) < maxLP)
                (depositLP, depositSeeds) = LibLPSilo.removeLPDeposit(msg.sender, seasons[i], amounts[i]);
            else
                (depositLP, depositSeeds) = LibLPSilo.removeLPDeposit(msg.sender, seasons[i], maxLP.sub(lpRemoved));
            lpRemoved = lpRemoved.add(depositLP);
            seedsRemoved = seedsRemoved.add(depositSeeds);
            stalkRemoved = stalkRemoved.add(depositSeeds.mul(C.getStalkPerLPSeed()).add(
                LibSilo.stalkReward(depositSeeds, season()-seasons[i]
            )));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = depositLP;
        while (i < seasons.length) {
            amounts[i] = 0;
            i++;
        }
        require(lpRemoved == maxLP, "Convert: Not enough tokens removed.");
        LibLPSilo.decrementDepositedLP(lpRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, seedsRemoved, stalkRemoved);
        stalkRemoved = stalkRemoved.sub(seedsRemoved.mul(C.getStalkPerLPSeed()));
        emit LPRemove(msg.sender, seasons, amounts, lpRemoved);
    }

    function _withdrawBeansForConvert(
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxBeans
    )
        internal
        returns (uint256 stalkRemoved) 
    {
        uint256 beansRemoved;
        (beansRemoved, stalkRemoved) = __withdrawBeansForConvert(seasons, amounts, maxBeans);
        require(beansRemoved == maxBeans, "Convert: Not enough Beans removed.");
    }

    function __withdrawBeansForConvert(
        uint32[] memory seasons,
        uint256[] memory amounts,
        uint256 maxBeans
    )
        internal
        returns (uint256 beansRemoved, uint256 stalkRemoved)
    {
        uint256 crateBeans;
        uint256 i = 0;
        while ((i < seasons.length) && (beansRemoved < maxBeans)) {
            if (beansRemoved.add(amounts[i]) < maxBeans)
                crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, seasons[i], amounts[i]);
            else
                crateBeans = LibBeanSilo.removeBeanDeposit(msg.sender, seasons[i], maxBeans.sub(beansRemoved));
            beansRemoved = beansRemoved.add(crateBeans);
            stalkRemoved = stalkRemoved.add(crateBeans.mul(C.getStalkPerBean()).add(
                LibSilo.stalkReward(crateBeans.mul(C.getSeedsPerBean()), season()-seasons[i]
            )));
            i++;
        }
        if (i > 0) amounts[i.sub(1)] = crateBeans;
        while (i < seasons.length) {
            amounts[i] = 0;
            i++;
        }
        LibBeanSilo.decrementDepositedBeans(beansRemoved);
        LibSilo.withdrawSiloAssets(msg.sender, beansRemoved.mul(C.getSeedsPerBean()), stalkRemoved);
        stalkRemoved = stalkRemoved.sub(beansRemoved.mul(C.getStalkPerBean()));
        emit BeanRemove(msg.sender, seasons, amounts, beansRemoved);
    }
}
