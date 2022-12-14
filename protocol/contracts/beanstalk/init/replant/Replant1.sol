/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../../libraries/Silo/LibTokenSilo.sol";
// import "../../../libraries/Silo/LibBeanSilo.sol";
import "../../../C.sol";

/**
 * @author Publius
 * @title Replant1 whips the exploiter's balances.
 * The steps to whip out the exploiter's balances are as follows: 
 * 1. Remove Deposits and emit Remove event
 * 2. Decrement Total Deposited amount
 * 3. Decrement Stalk, Seed, Root balance from totals
 * 4. Reset Stalk, Seed, Root balance
 * 
 * There are two addresses involved in the Beanstalk exploit.
 * The address that proposed the BIP and the address that voted and committed the BIP
 * 
 * ------------------------------------------------------------------------------------
 * The address that proposed the BIP is:
 * 0x1c5dCdd006EA78a7E4783f9e6021C32935a10fb4
 *
 * This address has 1 Silo Deposit to remove:
 * transactionHash: 0xf5a698984485d01e09744e8d7b8ca15cd29aa430a0137349c8c9e19e60c0bb9d
 * name:    BeanDeposit
 * season:  6046
 * beans:   212858495697
 * 
 * ------------------------------------------------------------------------------------
 * The address that voted on and committed the BIP is:
 * 0x79224bC0bf70EC34F0ef56ed8251619499a59dEf
 * 
 * This address has 2 Silo Deposits to remove both in the same transaction:
 * transactionHash: 0xcd314668aaa9bbfebaf1a0bd2b6553d01dd58899c508d4729fa7311dc5d33ad7
 *
 * name:    Deposit (General Silo Deposit)
 * token:   0x3a70DfA7d2262988064A2D051dd47521E43c9BdD
 * season:  6074
 * amount:  795425740813818200295323741
 * bdv:     789265388807140
 *
 * name:    Deposit (General Silo Deposit)
 * token:   0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D
 * season:  6074
 * amount:  58924887872471876761750555
 * bdv:     57932975182545
 * ------------------------------------------------------------------------------------
 **/
contract Replant1 {
    using SafeMath for uint256;
    AppStorage internal s;

    event BeanRemove(
        address indexed account,
        uint32[] crates,
        uint256[] crateBeans,
        uint256 beans
    );
    event RemoveSeason(
        address indexed account,
        address indexed token,
        uint32 season,
        uint256 amount
    );

    address private constant PROPOSER = 0x1c5dCdd006EA78a7E4783f9e6021C32935a10fb4;
    uint32 private constant PROPOSER_SEASON = 6046;
    uint256 private constant PROPOSER_AMOUNT = 212858495697;

    address private constant EXPLOITER = 0x79224bC0bf70EC34F0ef56ed8251619499a59dEf;
    uint32 private constant EXPLOITER_SEASON = 6074;
    address private constant EXPLOITER_TOKEN_1 = 0x3a70DfA7d2262988064A2D051dd47521E43c9BdD;
    uint256 private constant EXPLOITER_AMOUNT_1 = 795425740813818200295323741;
    address private constant EXPLOITER_TOKEN_2 = 0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D;
    uint256 private constant EXPLOITER_AMOUNT_2 = 58924887872471876761750555;

    function init() external {
        // 1. Remove Deposits
        LibTokenSilo.removeDepositFromAccount(
            EXPLOITER,
            EXPLOITER_TOKEN_1,
            EXPLOITER_SEASON,
            EXPLOITER_AMOUNT_1
        );
        emit RemoveSeason(
            EXPLOITER,
            EXPLOITER_TOKEN_1,
            EXPLOITER_SEASON,
            EXPLOITER_AMOUNT_1
        );

        LibTokenSilo.removeDepositFromAccount(
            EXPLOITER,
            EXPLOITER_TOKEN_2,
            EXPLOITER_SEASON,
            EXPLOITER_AMOUNT_2
        );
        emit RemoveSeason(
            EXPLOITER,
            EXPLOITER_TOKEN_2,
            EXPLOITER_SEASON,
            EXPLOITER_AMOUNT_2
        );

        // LibBeanSilo.removeBeanDeposit(PROPOSER, PROPOSER_SEASON, PROPOSER_AMOUNT);
        // uint32[] memory seasons = new uint32[](1);
        // uint256[] memory amounts = new uint256[](1);
        // seasons[0] = PROPOSER_SEASON;
        // amounts[0] = PROPOSER_AMOUNT;
        // emit BeanRemove(PROPOSER, seasons, amounts, PROPOSER_AMOUNT);

        // 2. Decrement Total Deposited for each token
        LibTokenSilo.decrementTotalDeposited(EXPLOITER_TOKEN_1, EXPLOITER_AMOUNT_1);
        LibTokenSilo.decrementTotalDeposited(EXPLOITER_TOKEN_2, EXPLOITER_AMOUNT_2);
        // LibBeanSilo.decrementDepositedBeans(PROPOSER_AMOUNT);

        // 3. Decrement total Stalk, Seeds, Roots 
        s.s.stalk = s.s.stalk.sub(s.a[PROPOSER].s.stalk).sub(s.a[EXPLOITER].s.stalk);
        s.s.seeds = s.s.seeds.sub(s.a[PROPOSER].s.seeds).sub(s.a[EXPLOITER].s.seeds);
        s.s.roots = s.s.roots.sub(s.a[PROPOSER].roots).sub(s.a[EXPLOITER].roots);

        // 4. Reset Stalk, Seed, Root balances
        s.a[PROPOSER].s.stalk = 0;
        s.a[EXPLOITER].s.stalk = 0;

        s.a[PROPOSER].s.seeds = 0;
        s.a[EXPLOITER].s.seeds = 0;

        s.a[PROPOSER].roots = 0;
        s.a[EXPLOITER].roots = 0;
    }
}
