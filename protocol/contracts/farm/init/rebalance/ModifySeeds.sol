/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../AppStorage.sol";
import "../../../C.sol";
import "../../../tokens/ERC20/BeanstalkERC20.sol";
import "../../../libraries/Silo/LibWhitelist.sol";
import "hardhat/console.sol";
import "../../../libraries/Silo/LibSilo.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";
import "../../facets/SiloFacet/TokenSilo.sol";

/**
 * @author pizzaman1337
 * @title Modifies the seed amount for unripe bean-3crv lp
 * Hopefully this will align incentives to arb more, rather than just hodl LP even when we're off peg
 * ------------------------------------------------------------------------------------
 **/


contract ModifySeeds {

    AppStorage internal s;

    address constant UNRIPE_LP_ADDRESS = 0x1BEA3CcD22F4EBd3d37d731BA31Eeca95713716D;

    using SafeMath for uint256;

    struct UnripeLPDeposits {
        address account;
        uint32 season;
    }

    event SeedsBalanceChanged(
        address indexed account,
        int256 delta
    );

    function init(UnripeLPDeposits[] calldata unripeDeposits) external {
        console.log("hello world from solidity");
        //console log before/after

        for (uint256 i; i < unripeDeposits.length; ++i) {
            address account = unripeDeposits[i].account;
            uint32 season = unripeDeposits[i].season;

            updateDepositSeeds(account, UNRIPE_LP_ADDRESS, season);
            console.log('did account: ', account, 'season:', season);
        }
    }

    function reduceUnripeLPSeeds() external {
        console.log("logging in reduceUnripeLPSeeds");
        console.log(s.ss[UNRIPE_LP_ADDRESS].seeds);


        //update unripe LP seeds to 2
        s.ss[UNRIPE_LP_ADDRESS].seeds = 2;
        console.log(s.ss[UNRIPE_LP_ADDRESS].seeds);
    }

    function updateDepositSeeds(address account, address token, uint32 season) private {

        console.log("calling getDeposit");
        
        (uint256 amount, uint256 bdv) = LibTokenSilo.tokenDeposit(account, token, season);

        console.log('amount: ', amount);
        console.log('bdv: ', bdv);


        //calculate diff to how many we should have
        uint256 newSeedsDiff = bdv.mul(4).sub(bdv.mul(2));

        console.log('before s.a[account].s.seeds: ', s.a[account].s.seeds);
        //subtract that many from current deposit amount
        decrementBalanceOfSeeds(account, newSeedsDiff);

        console.log('after s.a[account].s.seeds: ', s.a[account].s.seeds);

    }

    //this function was copy/pasted from LibSilo, can't call it from here because it's private
    function decrementBalanceOfSeeds(address account, uint256 seeds) private {
        s.s.seeds = s.s.seeds.sub(seeds);
        s.a[account].s.seeds = s.a[account].s.seeds.sub(seeds);
        emit SeedsBalanceChanged(account, -int256(seeds));
    }
}
