/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import "forge-std/Test.sol";
import {Utils} from "test/foundry/utils/Utils.sol";

// Diamond setup
import {Diamond} from "contracts/beanstalk/Diamond.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {MockInitDiamond} from "contracts/mocks/newMockInitDiamond.sol";
import {InitDiamond} from "contracts/mocks/newInitDiamond.sol";

/// Beanstalk Contracts (Facets, AppStorage, Constants).
import "test/foundry/utils/BeanstalkFacets.sol";

/**
 * @title TestHelper
 * @author Brean
 * @notice Test helper contract for Beanstalk tests.
 */
contract BeanstalkDeployer is Utils {

    // beanstalk
    address payable constant BEANSTALK  = payable(address(0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5));
  
    address internal deployer;
    
    /**
     * @notice deploys the beanstalk diamond contract.
     * @param mock if true, deploys all mocks and sets the diamond address to the canonical beanstalk address.
     */
    function setupDiamond(bool mock) public returns (Diamond d) {
        users = createUsers(6);
        deployer = users[0];
        vm.label(deployer, "Deployer");
        
        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](50);

        // add or remove facets here. Facets here do not have mocks.
        uint i;
        cut[i++] = _cut("BDVFacet", address(new BDVFacet()));
        cut[i++] = _cut("CurveFacet", address(new CurveFacet()));
        cut[i++] = _cut("FarmFacet", address(new FarmFacet()));
        cut[i++] = _cut("PauseFacet", address(new PauseFacet()));
        cut[i++] = _cut("OwnershipFacet", address(new OwnershipFacet()));
        cut[i++] = _cut("TokenFacet", address(new TokenFacet()));
        cut[i++] = _cut("GaugePointFacet", address(new GaugePointFacet()));
        cut[i++] = _cut("LiquidityWeightFacet", address(new LiquidityWeightFacet()));

        // facets with a mock counterpart should be added here.
        if(mock) {
            cut[i++] = _cut("MockAdminFacet", address(new MockAdminFacet()));
            cut[i++] = _cut("MockConvertFacet", address(new MockConvertFacet()));
            cut[i++] = _cut("MockFertilizerFacet", address(new MockFertilizerFacet()));
            cut[i++] = _cut("MockFieldFacet", address(new MockFieldFacet()));
            cut[i++] = _cut("MockFundraiserFacet", address(new MockFundraiserFacet()));
            cut[i++] = _cut("MockMarketplaceFacet", address(new MockMarketplaceFacet()));
            cut[i++] = _cut("MockSeasonFacet", address(new MockSeasonFacet()));
            cut[i++] = _cut("MockSiloFacet", address(new MockSiloFacet()));
            cut[i++] = _cut("MockUnripeFacet", address(new MockUnripeFacet()));
            cut[i++] = _cut("MockWhitelistFacet", payable(address(new MockWhitelistFacet())));
        } else {
            cut[i++] = _cut("ConvertFacet", address(new ConvertFacet()));
            cut[i++] = _cut("FertilizerFacet", address(new FertilizerFacet()));
            cut[i++] = _cut("FieldFacet", address(new FieldFacet()));
            cut[i++] = _cut("FundraiserFacet", address(new FundraiserFacet()));
            cut[i++] = _cut("MarketplaceFacet", address(new MarketplaceFacet()));
            cut[i++] = _cut("SeasonFacet", address(new SeasonFacet()));
            cut[i++] = _cut("SiloFacet", address(new SiloFacet()));
            cut[i++] = _cut("UnripeFacet", address(new UnripeFacet()));
            cut[i++] = _cut("WhitelistFacet", address(new WhitelistFacet()));
        }

        assembly {
            mstore(cut, i)
        }

        d = deployDiamondAtAddress(deployer, BEANSTALK);

        // if mocking, set the diamond address to
        // the canonical beanstalk address.
        address initDiamondAddress;
        if(mock) { 
            initDiamondAddress = address(new MockInitDiamond());
        } else {
            initDiamondAddress = address(new InitDiamond());
        }

        vm.prank(deployer);
        IDiamondCut(address(d)).diamondCut(
            cut,
            initDiamondAddress,
            abi.encodeWithSignature("init()")
        );

        console.log("Diamond deployed at: ", address(d));
    }

    //////////////////////// Deploy /////////////////////////

    /**
     * @notice deploys a diamond contract at an address.
     */
    function deployDiamondAtAddress(address _deployer, address payable beanstalkAddress) internal returns (Diamond d) {
        vm.prank(_deployer);
        deployCodeTo("Diamond.sol", abi.encode(_deployer), beanstalkAddress);
        return Diamond(beanstalkAddress);
    }

    function _cut(string memory _facetName, address _facetAddress)
        internal
        returns (IDiamondCut.FacetCut memory cut) 
    {
        bytes4[] memory functionSelectors = _generateSelectors(_facetName);
        cut = IDiamondCut.FacetCut({
            facetAddress: _facetAddress,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: functionSelectors
        });
    }

    function _generateSelectors(string memory _facetName)
        internal
        returns (bytes4[] memory selectors)
    {
        string[] memory cmd = new string[](3);
        cmd[0] = "node";
        cmd[1] = "scripts/genSelectors.js";
        cmd[2] = _facetName;
        bytes memory res = vm.ffi(cmd);
        selectors = abi.decode(res, (bytes4[]));
    }
}
