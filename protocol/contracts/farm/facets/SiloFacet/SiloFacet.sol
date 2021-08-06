/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanSilo.sol";

/**
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
**/
contract SiloFacet is BeanSilo {

    using SafeMath for uint256;
    using SafeMath for uint32;

    /**
     * Bean
    **/

    // Deposit

    function claimAndDepositBeans(uint256 amount, LibInternal.Claim calldata claim) external {
        LibInternal.claim(claim);
        depositBeans(amount);
    }

    function claimBuyAndDepositBeans(
        uint256 amount,
        uint256 buyAmount,
        LibInternal.Claim calldata claim
    )
        external
        payable
    {
        LibInternal.claim(claim);
        buyAndDepositBeans(amount, buyAmount);
    }

    function depositBeans(uint256 amount) public {
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(amount);
    }

    function buyAndDepositBeans(uint256 amount, uint256 buyAmount) public payable {
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        if (amount > 0) bean().transferFrom(msg.sender, address(this), amount);
        _depositBeans(boughtAmount.add(amount));
    }

    // Withdraw

    function withdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts
    )
        notLocked(msg.sender)
        external
    {
        _withdrawBeans(crates, amounts);
    }

    function claimAndWithdrawBeans(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibInternal.Claim calldata claim
    )
        notLocked(msg.sender)
        external
    {
        LibInternal.claim(claim);
        _withdrawBeans(crates, amounts);
    }

    /**
     * LP
    **/

    function claimAndDepositLP(uint256 amount, LibInternal.Claim calldata claim) external {
        LibInternal.claim(claim);
        depositLP(amount);
    }

    function claimAddAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
        LibInternal.Claim calldata claim
    )
        external
        payable
    {
        LibInternal.claim(claim);
        addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al);
    }

    function claimConvertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        LibInternal.Claim calldata claim
    )
        external
        payable
    {
        LibInternal.claim(claim);
        convertAddAndDepositLP(lp, al, crates, amounts);
    }

    function depositLP(uint256 amount) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount, season());
    }

    function addAndDepositLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(lp.add(boughtLP), season());
    }

    function convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts
    )
        public
        payable
    {
        updateSilo(msg.sender);
        WithdrawState memory w;
        if (totalDepositedBeans() < al.beanAmount) {
            w.beansTransferred = al.beanAmount.sub(totalDepositedBeans());
            bean().transferFrom(msg.sender, address(this), w.beansTransferred);
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al);
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = _withdrawBeansForConvert(crates, amounts, w.beansAdded);
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");

        if (amountFromWallet < w.beansTransferred)
            bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet));
        else if (w.beansTransferred < amountFromWallet) {
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            bean().transferFrom(msg.sender, address(this), transferAmount);
        }
        w.i = w.stalkRemoved.sub(w.beansRemoved.mul(C.getStalkPerBean()));
        w.i = w.i.div(lpToLPBeans(lp.add(w.newLP)), "Silo: No LP Beans.");

        uint32 depositSeason = uint32(season().sub(w.i.div(C.getSeedsPerLPBean())));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);

        _depositLP(lp.add(w.newLP), depositSeason);
        LibCheck.beanBalanceCheck();
        updateBalanceOfRainStalk(msg.sender);
    }

    /**
     * Withdraw
    **/

    function claimAndWithdrawLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibInternal.Claim calldata claim
    )
        notLocked(msg.sender)
        external
    {
        LibInternal.claim(claim);
        _withdrawLP(crates, amounts);
    }

    function withdrawLP(
        uint32[] calldata crates, uint256[]
        calldata amounts
    )
        notLocked(msg.sender)
        external
    {
        _withdrawLP(crates, amounts);
    }

}
