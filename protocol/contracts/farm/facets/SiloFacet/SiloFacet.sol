/*
 * SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./BeanSilo.sol";
import "../../../libraries/LibClaim.sol";
import "../../../libraries/LibMarket.sol";

/*
 * @author Publius
 * @title Silo handles depositing and withdrawing Beans and LP, and updating the Silo.
*/
contract SiloFacet is BeanSilo {

    event BeanAllocation(address indexed account, uint256 beans);

    using SafeMath for uint256;
    using SafeMath for uint32;

    /*
     * Bean
    */

    // Deposit

    function claimAndDepositBeans(uint256 amount, LibClaim.Claim calldata claim) external {
        allocateBeans(claim, amount);
        _depositBeans(amount);
    }

    function claimBuyAndDepositBeans(
        uint256 amount,
        uint256 buyAmount,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
        allocateBeans(claim, amount);
        uint256 boughtAmount = LibMarket.buyAndDeposit(buyAmount);
        _depositBeans(boughtAmount.add(amount));
    }

    function depositBeans(uint256 amount) public {
        bean().transferFrom(msg.sender, address(this), amount);
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
        LibClaim.Claim calldata claim
    )
        notLocked(msg.sender)
        external
    {
        LibClaim.claim(claim, claim.beansToWallet);
        _withdrawBeans(crates, amounts);
    }

    /*
     * LP
    */

    function claimAndDepositLP(uint256 amount, LibClaim.Claim calldata claim) external {
        LibClaim.claim(claim, claim.beansToWallet);
        depositLP(amount);
    }

    function claimAddAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
	LibClaim.Claim calldata claim
    )
        external
        payable
    {
        LibClaim.claim(claim, 0);
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, claim);
    }

    function depositLP(uint256 amount) public {
        pair().transferFrom(msg.sender, address(this), amount);
        _depositLP(amount);
    }

    function addAndDepositLP(uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
	LibClaim.Claim calldata c
    )
        public
        payable
    {
        require(buyBeanAmount == 0 || buyEthAmount == 0, "Silo: Silo: Cant buy Ether and Beans.");
        _addAndDepositLP(lp, buyBeanAmount, buyEthAmount, al, c);
    }
    
    function _addAndDepositLP(
        uint256 lp,
        uint256 buyBeanAmount,
        uint256 buyEthAmount,
        LibMarket.AddLiquidity calldata al,
	LibClaim.Claim calldata c
    )
        internal {
        uint256 boughtLP = LibMarket.swapAndAddLiquidity(buyBeanAmount, buyEthAmount, al, c);
        if (lp>0) pair().transferFrom(msg.sender, address(this), lp);
        _depositLP(lp.add(boughtLP), season());

    }

    function claimConvertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        LibClaim.Claim calldata claim
    )
        external
        payable
    {
	LibClaim.claim(claim, 0);
        _convertAddAndDepositLP(lp, al, crates, amounts, claim.beansToWallet);
    }

    function convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
	uint256 beansToWallet
    )
        public
        payable
    {
        _convertAddAndDepositLP(lp, al, crates, amounts, beansToWallet);
    }

    function _convertAddAndDepositLP(
        uint256 lp,
        LibMarket.AddLiquidity calldata al,
        uint32[] memory crates,
        uint256[] memory amounts,
        uint256 beansToWallet
    )
        private
    {
	updateSilo(msg.sender);
        WithdrawState memory w;
        if (IBean(s.c.bean).balanceOf(address(this)) < al.beanAmount) {
            w.beansTransferred = al.beanAmount.sub(totalDepositedBeans()); // amount of beans taken from user when he deposits more beans into LP than there are beans in the Silo
	    if (s.a[msg.sender].claimableBeans == 0) {
		    bean().transferFrom(msg.sender, address(this), w.beansTransferred);
	    }
            else {
                    if (s.a[msg.sender].claimableBeans > w.beansTransferred) {
			    s.a[msg.sender].claimableBeans = s.a[msg.sender].claimableBeans.sub(w.beansTransferred);
			    IBean(s.c.bean).mint(address(this), w.beansTransferred);
		    }
                    else if (s.a[msg.sender].claimableBeans == w.beansTransferred) {
			    s.a[msg.sender].claimableBeans = 0;
			    IBean(s.c.bean).mint(address(this), w.beansTransferred);
		    }
                    else {
			    require(s.a[msg.sender].claimableBeans.add(IBean(s.c.bean).balanceOf(msg.sender)) >= w.beansTransferred, "Silo: Not enough beans");
			    IBean(s.c.bean).mint(address(this), s.a[msg.sender].claimableBeans);
                            bean().transferFrom(msg.sender, address(this), w.beansTransferred.sub(s.a[msg.sender].claimableBeans));
			    s.a[msg.sender].claimableBeans = 0;
                    }
            }
        }
        (w.beansAdded, w.newLP) = LibMarket.addLiquidity(al); // w.beansAdded is beans added to LP
        require(w.newLP > 0, "Silo: No LP added.");
        (w.beansRemoved, w.stalkRemoved) = _withdrawBeansForConvert(crates, amounts, w.beansAdded); // w.beansRemoved is beans removed from Silo
        uint256 amountFromWallet = w.beansAdded.sub(w.beansRemoved, "Silo: Removed too many Beans.");
	
	bool flag = false;
        if (amountFromWallet < w.beansTransferred) {
            bean().transfer(msg.sender, w.beansTransferred.sub(amountFromWallet));
	}
        else if (w.beansTransferred < amountFromWallet) {
	    flag = true;
            uint256 transferAmount = amountFromWallet.sub(w.beansTransferred);
            LibMarket.transferAllocatedBeans(transferAmount, beansToWallet);
        }
        w.i = w.stalkRemoved.sub(w.beansRemoved.mul(C.getStalkPerBean()));
        w.i = w.i.div(lpToLPBeans(lp.add(w.newLP)), "Silo: No LP Beans.");

	if (!flag) {
		LibMarket.sendBeansToWallet(beansToWallet);
	}

        uint32 depositSeason = uint32(season().sub(w.i.div(C.getSeedsPerLPBean())));

        if (lp > 0) pair().transferFrom(msg.sender, address(this), lp);
	
        _depositLP(lp.add(w.newLP), depositSeason);
        LibCheck.beanBalanceCheck();
        updateBalanceOfRainStalk(msg.sender);
    }

    /*
     * Withdraw
    */

    function claimAndWithdrawLP(
        uint32[] calldata crates,
        uint256[] calldata amounts,
        LibClaim.Claim calldata claim
    )
        notLocked(msg.sender)
        external
    {
        LibClaim.claim(claim, claim.beansToWallet);
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

    function allocateBeans(LibClaim.Claim calldata c, uint256 transferBeans) private {
        LibClaim.claim(c, 0);
        LibMarket.transferAllocatedBeans(transferBeans, c.beansToWallet);
    }
}
