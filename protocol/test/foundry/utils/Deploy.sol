// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma abicoder v2;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import {Utils} from "./Utils.sol";

// Diamond setup
import {Diamond} from "@beanstalk/farm/Diamond.sol";
import {IDiamondCut} from "@beanstalk/interfaces/IDiamondCut.sol";
import {DiamondCutFacet} from "@beanstalk/farm/facets/DiamondCutFacet.sol";
import {DiamondLoupeFacet} from "@beanstalk/farm/facets/DiamondLoupeFacet.sol";
import {MockInitDiamond} from "@beanstalk/mocks/MockInitDiamond.sol";

// Facets
import {BDVFacet} from "@beanstalk/farm/facets/BDVFacet.sol";
import {CurveFacet} from "@beanstalk/farm/facets/CurveFacet.sol";
import {ConvertFacet} from "@beanstalk/farm/facets/ConvertFacet.sol";
import {MockConvertFacet} from "@beanstalk/mocks/mockFacets/MockConvertFacet.sol";
import {FarmFacet} from "@beanstalk/farm/facets/FarmFacet.sol";
import {MockFieldFacet} from "@beanstalk/mocks/mockFacets/MockFieldFacet.sol";
import {MockFundraiserFacet} from "@beanstalk/mocks/mockFacets/MockFundraiserFacet.sol";
import {MockMarketplaceFacet} from "@beanstalk/mocks/mockFacets/MockMarketplaceFacet.sol";
import {PauseFacet} from "@beanstalk/farm/facets/PauseFacet.sol";
import {MockSeasonFacet} from "@beanstalk/mocks/mockFacets/MockSeasonFacet.sol";
import {MockSiloFacet} from "@beanstalk/mocks/mockFacets/MockSiloFacet.sol";
import {MockFertilizerFacet} from "@beanstalk/mocks/mockFacets/MockFertilizerFacet.sol";
import {OwnershipFacet} from "@beanstalk/farm/facets/OwnershipFacet.sol";
import {TokenFacet} from "@beanstalk/farm/facets/TokenFacet.sol";
import {MockToken} from "@beanstalk/mocks/MockToken.sol";
import {MockUnripeFacet} from "@beanstalk/mocks/mockFacets/MockUnripeFacet.sol";
// import {WellBuildingFacet} from "@beanstalk/farm/facets/WellBuildingFacet.sol";
// import {WellFacet} from "@beanstalk/farm/facets/WellFacet.sol";
// import {WellOracleFacet} from "@beanstalk/farm/facets/WellOracleFacet.sol";
import {WhitelistFacet} from "@beanstalk/farm/facets/WhitelistFacet.sol";

import {BeanstalkPrice} from "@beanstalk/price/BeanstalkPrice.sol";
import {Mock3Curve} from "@beanstalk/mocks/curve/Mock3Curve.sol";
import {MockCurveFactory} from "@beanstalk/mocks/curve/MockCurveFactory.sol";
import {MockCurveZap} from "@beanstalk/mocks/curve/MockCurveZap.sol";
import {MockMeta3Curve} from "@beanstalk/mocks/curve/MockMeta3Curve.sol";
import {MockWETH} from "@beanstalk/mocks/MockWETH.sol";

import "@beanstalk/C.sol";

contract DiamondDeployer is Test {
  Utils internal utils;
  address payable[] internal users;
  address internal alice;

  address internal THREE_CRV = address(C.threeCrv());

  function deployMock() public returns (Diamond d) {
    // create accounts
    utils = new Utils();
    users = utils.createUsers(1);
    address deployer = users[0];
    vm.label(deployer, "Deployer");
    console.log("Deployer: %s", deployer);

    // create facet cuts
    IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](14);

    cut[0] = _cut("BDVFacet", address(new BDVFacet()));
    cut[1] = _cut("CurveFacet", address(new CurveFacet()));
    cut[2] = _cut("MockConvertFacet", address(new MockConvertFacet()));
    cut[3] = _cut("FarmFacet", address(new FarmFacet()));
    cut[4] = _cut("MockFieldFacet", address(new MockFieldFacet()));
    cut[5] = _cut("MockFundraiserFacet", address(new MockFundraiserFacet()));
    cut[6] = _cut("PauseFacet", address(new PauseFacet()));
    cut[7] = _cut("MockSeasonFacet", address(new MockSeasonFacet()));
    cut[8] = _cut("MockSiloFacet", address(new MockSiloFacet()));
    cut[9] = _cut("MockFertilizerFacet", address(new MockFertilizerFacet()));
    cut[10] = _cut("OwnershipFacet", address(new OwnershipFacet()));
    cut[11] = _cut("TokenFacet", address(new TokenFacet()));
    cut[12] = _cut("MockUnripeFacet", address(new MockUnripeFacet()));
    cut[13] = _cut("WhitelistFacet", address(new WhitelistFacet()));
    // cut[13] = _cut("WellBuildingFacet", address(new WellBuildingFacet()));
    // cut[14] = _cut("WellFacet", address(new WellFacet()));
    // cut[15] = _cut("WellOracleFacet", address(new WellOracleFacet()));

    console.log("Deployed mock facets.");

    // impersonate tokens and utilities
    _mockToken("Bean", address(C.bean()));
    _mockToken("USDC", address(C.usdc()));
    _mockPrice();
    _mockCurve(); // only if "reset"
    _mockWeth(); // only if "reset"
    // _mockCurveMetapool();
    _mockUnripe();
    // _mockFertilizer();

    // create diamond    
    d = new Diamond(deployer);
    MockInitDiamond i = new MockInitDiamond();

    console.log("Initialized diamond at %s", address(d));

    // run diamond cut
    vm.prank(deployer);
    IDiamondCut(address(d)).diamondCut(
      cut,
      address(i), // address of contract with init() function
      abi.encodeWithSignature("init()")
    );

    console.log("Diamond cut successful.");
  }

  function _etch(string memory _file, address _address) internal returns (address) {
    deployCode(_file, abi.encode(""));
    bytes memory code = vm.getDeployedCode(_file);
    vm.etch(_address, code);
    return _address;
  }

  function _mockToken(string memory _tokenName, address _tokenAddress) internal returns (MockToken) {
    console.log("Mock token: %s @ %s", _tokenName, _tokenAddress);
    return MockToken(_etch("MockToken.sol", _tokenAddress));
  }

  function _mockWeth() internal returns (MockWETH) {
    address payable weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    console.log("Mock token: WETH @ %s", weth);
    return MockWETH(payable(_etch("MockWETH.sol", weth)));
  }

  function _mockPrice() internal returns (BeanstalkPrice p) {
    address PRICE_DEPLOYER = 0x884B463E078Ff26C4b83792dB9bEF33619a69767;
    vm.prank(PRICE_DEPLOYER);
    p = new BeanstalkPrice();
  }

  function _mockCurve() internal {
    MockToken crv3 = _mockToken("3CRV", THREE_CRV);

    //
    Mock3Curve pool3 = Mock3Curve(_etch("Mock3Curve.sol", C.curve3PoolAddress())); // 3Curve = 3Pool

    //
    address STABLE_FACTORY = 0xB9fC157394Af804a3578134A6585C0dc9cc990d4;
    MockCurveFactory stableFactory = MockCurveFactory(_etch("MockCurveFactory.sol", STABLE_FACTORY));

    //
    // address CRYPTO_REGISTRY = 0x8F942C20D02bEfc377D41445793068908E2250D0;
    address CURVE_REGISTRY = 0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5;
    _etch("MockToken.sol", CURVE_REGISTRY); // why this interface?
    stableFactory.set_coins(C.curveMetapoolAddress(), [
      C.beanAddress(),
      THREE_CRV,
      address(0),
      address(0)
    ]);

    //
    MockCurveZap curveZap = MockCurveZap(_etch("MockCurveZap.sol", C.curveZapAddress()));
    curveZap.approve();
  }

  function _mockCurveMetapool() internal {
    MockMeta3Curve p = MockMeta3Curve(_etch("MockMeta3Curve.sol", C.curveMetapoolAddress()));
    p.init(C.beanAddress(), THREE_CRV, C.curve3PoolAddress());
    p.set_A_precise(1000);
    p.set_virtual_price(1 wei);
  }

  function _mockUnripe() internal {
    MockToken urbean = _mockToken("Unripe BEAN", C.unripeBeanAddress());
    urbean.setDecimals(6);
    _mockToken("Unripe BEAN:3CRV", C.unripeLPAddress());
  }

  function _printAddresses() internal view {
    console.log("C: Bean = %s", address(C.bean()));
  }

  function _cut(string memory _facetName, address _facetAddress)
    internal
    returns (IDiamondCut.FacetCut memory cut) 
  {
    bytes4[] memory functionSelectors = _generateSelectors(_facetName);
    console.log("FacetCut: %s @ %s (%s selectors)", _facetName, _facetAddress, functionSelectors.length);
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