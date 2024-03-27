/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";

// Diamond setup
import {Diamond} from "contracts/beanstalk/Diamond.sol";
import {IDiamondCut} from "contracts/interfaces/IDiamondCut.sol";
import {MockInitDiamond} from "contracts/mocks/newMockInitDiamond.sol";
import {InitDiamond} from "contracts/mocks/newInitDiamond.sol";

/// Beanstalk Contracts w/external libraries.
import {UnripeFacet, MockUnripeFacet} from "contracts/mocks/mockFacets/MockUnripeFacet.sol";
import {MockConvertFacet, ConvertFacet} from "contracts/mocks/mockFacets/MockConvertFacet.sol";
import {MockSeasonFacet, SeasonFacet} from "contracts/mocks/mockFacets/MockSeasonFacet.sol";
import {SeasonGettersFacet} from "contracts/beanstalk/sun/SeasonFacet/SeasonGettersFacet.sol";

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
    function setupDiamond(bool mock, bool verbose) internal returns (Diamond d) {
        users = createUsers(6);
        deployer = users[0];
        vm.label(deployer, "Deployer");
        vm.label(BEANSTALK, "Beanstalk");
        
        // create facet cuts
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](50);
        // Facets that require external libraries need to be deployed by 
        // `address(new Facet())`
        // otherwise, use deployCode() to speed up test compiles.

        // add or remove facets here. Facets here do not have mocks.
        uint i;
        cut[i++] = _cut("BDVFacet", address(deployCode("BDVFacet.sol")));
        cut[i++] = _cut("CurveFacet", address(deployCode("CurveFacet.sol")));
        cut[i++] = _cut("FarmFacet", address(deployCode("FarmFacet.sol")));
        cut[i++] = _cut("PauseFacet", address(deployCode("PauseFacet.sol")));
        cut[i++] = _cut("OwnershipFacet", address(deployCode("OwnershipFacet.sol")));
        cut[i++] = _cut("TokenFacet", address(deployCode("TokenFacet.sol")));
        cut[i++] = _cut("TokenSupportFacet", address(deployCode("TokenSupportFacet.sol")));
        cut[i++] = _cut("GaugePointFacet", address(deployCode("GaugePointFacet.sol")));
        cut[i++] = _cut("LiquidityWeightFacet", address(deployCode("LiquidityWeightFacet.sol")));
        cut[i++] = _cut("SiloGettersFacet", address(deployCode("SiloGettersFacet.sol")));
        cut[i++] = _cut("ConvertGettersFacet", address(deployCode("ConvertGettersFacet.sol")));
        cut[i++] = _cut("MetadataFacet", address(deployCode("MetadataFacet.sol")));
        cut[i++] = _cut("SeasonGettersFacet", address(new SeasonGettersFacet()));

        // facets with a mock counterpart should be added here.
        if (mock) {
            cut[i++] = _cut("MockAdminFacet", address(deployCode("MockAdminFacet.sol")));
            cut[i++] = _cut("MockFertilizerFacet", address(deployCode("MockFertilizerFacet.sol")));
            cut[i++] = _cut("MockFieldFacet", address(deployCode("MockFieldFacet.sol")));
            cut[i++] = _cut("MockFundraiserFacet", address(deployCode("MockFundraiserFacet.sol")));
            cut[i++] = _cut("MockMarketplaceFacet", address(deployCode("MockMarketplaceFacet.sol")));
            cut[i++] = _cut("MockWhitelistFacet", address(deployCode("MockWhitelistFacet.sol")));
            cut[i++] = _cut("MockSiloFacet", address(deployCode("MockSiloFacet.sol")));
            cut[i++] = _cut("MockUnripeFacet", address(new MockUnripeFacet()));
            cut[i++] = _cut("MockConvertFacet", address(new MockConvertFacet()));
            cut[i++] = _cut("MockSeasonFacet", address(new MockSeasonFacet()));
        } else {
            cut[i++] = _cut("FertilizerFacet", address(deployCode("FertilizerFacet.sol")));
            cut[i++] = _cut("FieldFacet", address(deployCode("FieldFacet.sol")));
            cut[i++] = _cut("FundraiserFacet", address(deployCode("FundraiserFacet.sol")));
            cut[i++] = _cut("MarketplaceFacet", address(deployCode("MarketplaceFacet.sol")));
            cut[i++] = _cut("WhitelistFacet", address(deployCode("WhitelistFacet.sol")));
            cut[i++] = _cut("SiloFacet", address(deployCode("SiloFacet.sol")));
            cut[i++] = _cut("UnripeFacet", address(new UnripeFacet()));
            cut[i++] = _cut("ConvertFacet", address(new ConvertFacet()));
            cut[i++] = _cut("SeasonFacet", address(new SeasonFacet()));
        }

        assembly {
            mstore(cut, i)
        }

        d = deployDiamondAtAddress(deployer, BEANSTALK);

        // if mocking, set the diamond address to
        // the canonical beanstalk address.
        address initDiamondAddress;
        if (mock) { 
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

        if(verbose) console.log("Diamond deployed at: ", address(d));
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
