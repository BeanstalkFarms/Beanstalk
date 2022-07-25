/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";
import "../../../C.sol";
/**
 * @author Publius
 * @title Replant4 Remove all pre-exploit LP Token Withdrawals
 * ------------------------------------------------------------------------------------
 **/
contract Replant4 {

    AppStorage internal s;

    using SafeMath for uint256;

    event ClaimSeasons(address indexed account, address indexed token, uint32[] seasons, uint256 amount);
    event ClaimSeason(address indexed account, address indexed token, uint32 season, uint256 amount);
    event LPClaim(address indexed account, uint32[] withdrawals, uint256 lp);

    struct LPWithdrawals {
        address account;
        uint32[] seasons;
        uint256 amount;
    }

    struct Withdrawals {
        address account;
        address token;
        uint32[] seasons;
        uint256 amount;
    }

    function init(
        LPWithdrawals[] calldata lpWithdrawals, 
        Withdrawals[] calldata withdrawals
    ) external {
        claimLPWithdrawals(lpWithdrawals);
        claimWithdrawals(withdrawals);
        s.siloBalances[C.unripeLPPool1()].withdrawn = 0;
        s.siloBalances[C.unripeLPPool2()].withdrawn = 0;
    }

    function claimLPWithdrawals(LPWithdrawals[] calldata w)
        private
    {
        for (uint256 i; i < w.length; ++i) {
            emit LPClaim(w[i].account, w[i].seasons, w[i].amount);

        }
    }

    function claimWithdrawals(Withdrawals[] calldata w)
        private
    {
        for (uint256 i; i < w.length; ++i) {
            for (uint256 j = 0; j < w[i].seasons.length; j++) {
                delete s.a[w[i].account].withdrawals[w[i].token][w[i].seasons[j]];
            }
            emit ClaimSeasons(w[i].account, w[i].token, w[i].seasons, w[i].amount);
        }
    }
}
