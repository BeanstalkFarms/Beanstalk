const { re } = require("mathjs")
const { BEANSTALK } = require("../test/utils/constants")
const { impersonateBeanstalk } = require("./impersonate")
const fs = require('fs')

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2
}

// eslint-disable-next-line no-unused-vars
function getSignatures (contract) {
  return Object.keys(contract.interface.functions)
}

function addCommas (nStr) {
  nStr += ''
  const x = nStr.split('.')
  let x1 = x[0]
  const x2 = x.length > 1 ? '.' + x[1] : ''
  var rgx = /(\d+)(\d{3})/
  while (rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2')
  }
  return x1 + x2
}

function strDisplay(str) {
  return addCommas(str.toString())
}

function getSelectors (contract) {
  const signatures = Object.keys(contract.interface.functions)
  const selectors = signatures.reduce((acc, val) => {
    if (val !== 'init(bytes)' && val !== 'c_0x4820c4cf(bytes32)') {
      acc.push(contract.interface.getSighash(val))
    }
    return acc
  }, [])
  return selectors
}

async function deployLibraries(libraryNames, account, verify = false, verbose = true) {
  // Deploy libraries
  let libraries = {};
  for (const libName of libraryNames) {
    if (verbose) console.log(`Deploying: ${libName}`);
    const LibraryFactory = await ethers.getContractFactory(libName, account);
    const library = await LibraryFactory.deploy();
    await library.deployed();
    if (verify) {
      await run(`verify`, {
        address: library.address,
      });
    }
    const receipt = await library.deployTransaction.wait();
    if (verbose) console.log(`${libName} deploy gas used: ` + strDisplay(receipt.gasUsed));
    if (verbose) console.log(`Deployed at ${library.address}`);
    libraries[libName] = library.address;
  }
  return libraries;
}

async function deployFacetsWithLinkedLibraries(facets, libraryNames, facetLibraries, account, verify = false, verbose = true) {
  // Deploy facets with linked libraries
  const deployed = [];
  for (const facetName of facets) {
    let facetFactory;
    if (facetLibraries[facetName]) {
      // Prepare libraries to be linked
      const linkedLibraries = {};
      for (const libName of facetLibraries[facetName]) {
        linkedLibraries[libName] = libraries[libName];
      }
      facetFactory = await ethers.getContractFactory(facetName, {
        libraries: linkedLibraries,
      }, account);
    } else {
      facetFactory = await ethers.getContractFactory(facetName, account);
    }
    if (verbose) console.log(`Deploying ${facetName}`);
    const deployedFactory = await facetFactory.deploy();
    await deployedFactory.deployed();
    await deployedFactory.deployTransaction.wait();
    if (verbose) console.log(`${facetName} deployed: ${deployedFactory.address}`);
    if (verbose) console.log('--');
    deployed.push([facetName, deployedFactory]);
  }
  return deployed;
}

async function deployFacets (facets, libraryNames, facetLibraries, verify = false, verbose = true, account) {
  for (const name of libraryNames) {
      if (verbose) console.log(`Deploying: ${name}`)
      let libraryFactory = await ethers.getContractFactory(name, account)
      libraryFactory = await libraryFactory.deploy()
      await libraryFactory.deployed()
      if (verify) {
        await run(`verify`, {
          address: libraryFactory.address
        });
      }
      const receipt = await libraryFactory.deployTransaction.wait()
      if (verbose) console.log(`${name} deploy gas used: ` + strDisplay(receipt.gasUsed))
      // totalGasUsed = totalGasUsed.add(receipt.gasUsed)
      if (verbose) console.log(`Deployed at ${libraryFactory.address}`)
      // libraries[name] = libraryFactory.address
    }
  if (verbose) console.log('--')
  const deployed = []
  for (const facet of facets) {
    if (Array.isArray(facet)) {
      if (typeof facet[0] !== 'string') {
        throw Error(`Error using facet: facet name must be a string. Bad input: ${facet[0]}`)
      }
      if (!(facet[1] instanceof ethers.Contract)) {
        throw Error(`Error using facet: facet must be a Contract. Bad input: ${facet[1]}`)
      }
      if (verbose) console.log(`Using already deployed ${facet[0]}: ${facet[1].address}`)
      if (verbose) console.log('--')
      deployed.push(facet)
    } else {
      if (typeof facet !== 'string') {
        throw Error(`Error deploying facet: facet name must be a string. Bad input: ${facet}`)
      }
      const facetFactory = await ethers.getContractFactory(facet, account)
      if (verbose) console.log(`Deploying ${facet}`)
      const deployedFactory = await facetFactory.deploy()
      await deployedFactory.deployed()
      await deployedFactory.deployTransaction.wait()
      if (verbose) console.log(`${facet} deployed: ${deployedFactory.address}`)
      if (verbose) console.log('--')
      deployed.push([facet, deployedFactory])
    }
  }
  return deployed
}

// Deploy only diamond and storage with initDiamond contract if provided
async function deployInitDiamond({
  diamondName,
  initDiamond,
  owner,
  verbose = false,
  impersonate = false
}) {
  if (arguments.length !== 1) {
    throw Error(`Requires only 1 map argument. ${arguments.length} arguments used.`);
  }
  const diamondFactory = await ethers.getContractFactory("Diamond");
  const diamondCut = [];
  if (verbose) {
    console.log("--");
    console.log("Setting up diamondCut args");
    console.log("--");
  }
  let result;
  if (typeof initDiamond === "string") {
    const initDiamondName = initDiamond;
    if (verbose) console.log(`Deploying ${initDiamondName}`);
    initDiamond = await ethers.getContractFactory(initDiamond);
    initDiamond = await initDiamond.deploy();
    await initDiamond.deployed();
    result = await initDiamond.deployTransaction.wait();
    if (!result.status) {
      throw Error(
        `Deploying ${initDiamondName} TRANSACTION FAILED!!! -------------------------------------------`
      );
    }
  }

  if (verbose) console.log(`Deploying ${diamondName}`);

  let deployedDiamond;
  if (!impersonate) {
    deployedDiamond = await diamondFactory.deploy(owner.address);
    await deployedDiamond.deployed();
    result = await deployedDiamond.deployTransaction.wait();
    if (!result.status) {
      console.log(
        "Deploying diamond TRANSACTION FAILED!!! -------------------------------------------"
      );
      console.log("See block explorer app for details.");
      console.log("Transaction hash:" + deployedDiamond.deployTransaction.hash);
      throw Error("failed to deploy diamond");
    }
    if (verbose)
      console.log("Diamond deploy transaction hash:" + deployedDiamond.deployTransaction.hash);

    if (verbose) console.log(`${diamondName} deployed: ${deployedDiamond.address}`);
    if (verbose) console.log(`Diamond owner: ${owner.address}`);
  } else {
    await impersonateBeanstalk(owner.address);
    deployedDiamond = await ethers.getContractAt("Diamond", BEANSTALK);
  }

  return deployedDiamond;
}

async function deploy ({
  diamondName,  
  initDiamond,
  facets,
  owner,
  libraryNames = [],
  facetLibraries = {},
  args = [],
  verbose = false,
  txArgs = {},
  impersonate = false
}) {
  if (arguments.length !== 1) {
    throw Error(`Requires only 1 map argument. ${arguments.length} arguments used.`)
  }
  // Deploy libraries
  libraries = await deployLibraries(libraryNames, owner, false, true);
  // Deploy facets with linked libraries
  facets = await deployFacetsWithLinkedLibraries(facets, libraryNames,facetLibraries, owner, false, true);

  // Deploy diamond
  const diamondFactory = await ethers.getContractFactory('Diamond')
  const diamondCut = []
  if (verbose) {
    console.log('--') 
    console.log('Setting up diamondCut args')
    console.log('--')
  }
  for (const [name, deployedFacet] of facets) {
    if (verbose) {
      console.log(name)
      console.log(getSignatures(deployedFacet))
      console.log('--')
    }
    diamondCut.push([
      deployedFacet.address,
      FacetCutAction.Add,
      getSelectors(deployedFacet)
    ])
  }
  if (verbose) console.log('--')
  
  let functionCall
  if (initDiamond !== undefined) {
    let result
    if (typeof initDiamond === 'string') {
      const initDiamondName = initDiamond
      if (verbose) console.log(`Deploying ${initDiamondName}`)
      initDiamond = await ethers.getContractFactory(initDiamond)
      initDiamond = await initDiamond.deploy()
      await initDiamond.deployed()
      result = await initDiamond.deployTransaction.wait()
      if (!result.status) {
        throw (Error(`Deploying ${initDiamondName} TRANSACTION FAILED!!! -------------------------------------------`))
      }
    }
    if (verbose) console.log('Encoding diamondCut init function call')
    functionCall = initDiamond.interface.encodeFunctionData('init', args)
  }

  if (verbose) console.log(`Deploying ${diamondName}`)

  let deployedDiamond
  if (!impersonate) {
    // deploy with owner address as owner
    deployedDiamond = await diamondFactory.deploy(owner.address)
    await deployedDiamond.deployed()
    result = await deployedDiamond.deployTransaction.wait()
    if (!result.status) {
      console.log('Deploying diamond TRANSACTION FAILED!!! -------------------------------------------')
      console.log('See block explorer app for details.')
      console.log('Transaction hash:' + deployedDiamond.deployTransaction.hash)
      throw (Error('failed to deploy diamond'))
    }
    if (verbose) console.log('Diamond deploy transaction hash:' + deployedDiamond.deployTransaction.hash)
    if (verbose) console.log(`${diamondName} deployed: ${deployedDiamond.address}`)
    if (verbose) console.log(`Diamond owner: ${owner.address}`)
  } else {
    await impersonateBeanstalk(owner.address)
    deployedDiamond = await ethers.getContractAt('Diamond', BEANSTALK)
  }

  console.log('///////// Deployed Diamond: ' + deployedDiamond.address)

  console.log('///////// Preparing DiamondCut')
  const diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', deployedDiamond.address)
  
  // handle diamondCut tx 
  if (initDiamond !== undefined) {
    const tx = await diamondCutFacet.connect(owner).diamondCut(diamondCut, initDiamond.address, functionCall, txArgs)
    result = await tx.wait()
    console.log(`${diamondName} diamondCut arguments:`)
    console.log(JSON.stringify([facets, initDiamond.address, args], null, 4))
    if (!result.status) {
      console.log('TRANSACTION FAILED!!! -------------------------------------------')
      console.log('See block explorer app for details.')
    }
    if (verbose) console.log('DiamondCut success!')
    if (verbose) console.log('Transaction hash:' + tx.hash)
    if (verbose) console.log('--')
    return [deployedDiamond, result]
  } else {
    const result = await diamondCutFacet.connect(owner).diamondCut(
      diamondCut,
      ethers.constants.AddressZero,
      "0x",
      txArgs
    )
    const receipt = await result.wait()
    console.log("DiamondCut success!")
    return [deployedDiamond];
  }
}

function inFacets (selector, facets) {
  for (const facet of facets) {
    if (facet.functionSelectors.includes(selector)) {
      return true
    }
  }
  return false
}

async function upgrade ({
  diamondAddress,
  diamondCut,
  txArgs = {},
  initFacetName = undefined,
  initArgs
}) {
  if (arguments.length !== 1) {
    throw Error(`Requires only 1 map argument. ${arguments.length} arguments used.`)
  }
  const diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
  const diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)
  const existingFacets = await diamondLoupeFacet.facets()
  const facetFactories = new Map()

  console.log('Facet Signatures and Selectors: ')
  for (const facet of diamondCut) {
    const functions = new Map()
    const selectors = []
    console.log('Facet: ' + facet)
    let facetName
    let contract
    if (Array.isArray(facet[0])) {
      facetName = facet[0][0]
      contract = facet[0][1]
      if (!(typeof facetName === 'string')) {
        throw Error('First value in facet[0] array must be a string.')
      }
      if (!(contract instanceof ethers.Contract)) {
        throw Error('Second value in facet[0] array must be a Contract object.')
      }
      facet[0] = facetName
    } else {
      facetName = facet[0]
      if (!(typeof facetName === 'string') && facetName) {
        throw Error('facet[0] must be a string or an array or false.')
      }
    }
    for (const signature of facet[2]) {
      const selector = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(signature)).slice(0, 10)
      console.log(`Function: ${selector} ${signature}`)
      selectors.push(selector)
      functions.set(selector, signature)
    }
    if (facet[1] === FacetCutAction.Remove) {
      if (facetName) {
        throw (Error(`Can't remove functions because facet name must have a false value not ${facetName}.`))
      }
      facet[0] = ethers.constants.AddressZero
      for (const selector of selectors) {
        if (!inFacets(selector, existingFacets)) {
          const signature = functions.get(selector)
          throw Error(`Can't remove '${signature}'. It doesn't exist in deployed diamond.`)
        }
      }
      facet[2] = selectors
    } else if (facet[1] === FacetCutAction.Replace) {
      let facetFactory = facetFactories.get(facetName)
      if (!facetFactory) {
        if (contract) {
          facetFactories.set(facetName, contract)
        } else {
          facetFactory = await ethers.getContractFactory(facetName)
          facetFactories.set(facetName, facetFactory)
        }
      }
      for (const signature of facet[2]) {
        if (!Object.prototype.hasOwnProperty.call(facetFactory.interface.functions, signature)) {
          throw (Error(`Can't replace '${signature}'. It doesn't exist in ${facetName} source code.`))
        }
      }
      for (const selector of selectors) {
        if (!inFacets(selector, existingFacets)) {
          const signature = functions.get(selector)
          throw Error(`Can't replace '${signature}'. It doesn't exist in deployed diamond.`)
        }
      }
      facet[2] = selectors
    } else if (facet[1] === FacetCutAction.Add) {
      let facetFactory = facetFactories.get(facetName)
      if (!facetFactory) {
        if (contract) {
          facetFactories.set(facetName, contract)
        } else {
          facetFactory = await ethers.getContractFactory(facetName, account)
          facetFactories.set(facetName, facetFactory)
        }
      }
      for (const signature of facet[2]) {
        if (!Object.prototype.hasOwnProperty.call(facetFactory.interface.functions, signature)) {
          throw (Error(`Can't add ${signature}. It doesn't exist in ${facetName} source code.`))
        }
      }
      for (const selector of selectors) {
        if (inFacets(selector, existingFacets)) {
          const signature = functions.get(selector)
          throw Error(`Can't add '${signature}'. It already exists in deployed diamond.`)
        }
      }
      facet[2] = selectors
    } else {
      throw (Error('Incorrect FacetCutAction value. Must be 0, 1 or 2. Value used: ' + facet[1]))
    }
  }
  // deploying new facets
  const alreadDeployed = new Map()
  for (const facet of diamondCut) {
    if (facet[1] !== FacetCutAction.Remove) {
      const existingAddress = alreadDeployed.get(facet[0])
      if (existingAddress) {
        facet[0] = existingAddress
        continue
      }
      console.log(`Deploying ${facet[0]}`)
      const facetFactory = facetFactories.get(facet[0])
      let deployedFacet = facetFactory
      if (!(deployedFacet instanceof ethers.Contract)) {
        deployedFacet = await facetFactory.deploy()
        await deployedFacet.deployed()
        await deployedFacet.deployTransaction.wait()
      }
      facetFactories.set(facet[0], deployedFacet)
      console.log(`${facet[0]} deployed: ${deployedFacet.address}`)
      alreadDeployed.set(facet[0], deployedFacet.address)
      facet[0] = deployedFacet.address
    }
  }

  console.log('diamondCut arg:')
  console.log(diamondCut)

  let initFacetAddress = ethers.constants.AddressZero
  let functionCall = '0x'
  if (initFacetName !== undefined) {
    let initFacet = facetFactories.get(initFacetName)
    if (!initFacet) {
      const InitFacet = await ethers.getContractFactory(initFacetName, account)
      initFacet = await InitFacet.deploy()
      await initFacet.deployed()
      await initFacet.deployTransaction.wait()
      console.log('Deployed init facet: ' + initFacet.address)
    } else {
      console.log('Using init facet: ' + initFacet.address)
    }
    functionCall = initFacet.interface.encodeFunctionData('init', initArgs)
    console.log('Function call: ')
    console.log(functionCall)
    initFacetAddress = initFacet.address
  }

  const result = await diamondCutFacet.diamondCut(
    diamondCut,
    initFacetAddress,
    functionCall,
    txArgs
  )
  const receipt = await result.wait()
  if (!receipt.status) {
    console.log('TRANSACTION FAILED!!! -------------------------------------------')
    console.log('See block explorer app for details.')
  }
  console.log('------')
  console.log('Upgrade transaction hash: ' + result.hash)
  return result
}

async function upgradeWithNewFacets ({
  diamondAddress,
  facetNames = [],
  facetLibraries = {},
  libraryNames = [],
  selectorsToRemove = [],
  selectorsToAdd = {},
  initFacetName = undefined,
  initArgs = [],
  libraries = {},
  initFacetAddress = ethers.constants.AddressZero,
  bip = false,
  object = false,
  p=0,
  verbose = false,
  account = null,
  verify = false
}) {

  let totalGasUsed = ethers.BigNumber.from('0')

  if (arguments.length !== 1) {
    throw Error(`Requires only 1 map argument. ${arguments.length} arguments used.`)
  }
  const diamondCutFacet = await ethers.getContractAt('DiamondCutFacet', diamondAddress)
  const diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamondAddress)

  const diamondCut = []
  const existingFacets = await diamondLoupeFacet.facets()
  const undeployed = []
  const deployed = []
  if (verbose && libraryNames.length > 0) console.log('Deploying Libraries')
  for (const name of libraryNames) {
    if (!Object.keys(libraries).includes(name)) {
      if (verbose) console.log(`Deploying: ${name}`)
      let libraryFactory = await ethers.getContractFactory(name, account)
      libraryFactory = await libraryFactory.deploy()
      await libraryFactory.deployed()
      if (verify) {
        await run(`verify`, {
          address: libraryFactory.address
        });
      }
      const receipt = await libraryFactory.deployTransaction.wait()
      if (verbose) console.log(`${name} deploy gas used: ` + strDisplay(receipt.gasUsed))
      totalGasUsed = totalGasUsed.add(receipt.gasUsed)
      if (verbose) console.log(`Deployed at ${libraryFactory.address}`)
      libraries[name] = libraryFactory.address
    }
  }
  if (verbose && facetNames.length > 0) console.log('\nDeploying Facets')
  for (const name of facetNames) {
    let facetFactory
    if (facetLibraries[name] !== undefined) {
      let facetLibrary = Object.keys(libraries).reduce((acc,val) => {
        if (facetLibraries[name].includes(val)) acc[val] = libraries[val];
        return acc;
      }, {});
      facetFactory = await ethers.getContractFactory(name, {
        libraries: facetLibrary
      },
      account
      );
    }
    else facetFactory = await ethers.getContractFactory(name, account)
    undeployed.push([name, facetFactory])
  }
  if (verbose) console.log('')
  if (selectorsToRemove.length > 0) {
    // check if any selectorsToRemove are already gone
    for (const selector of selectorsToRemove) {
      if (!inFacets(selector, existingFacets)) {
        throw Error('Function selector to remove is already gone.')
      }
    }
    diamondCut.push([
      ethers.constants.AddressZero,
      FacetCutAction.Remove,
      selectorsToRemove
    ])
  }

  for (const [name, facetFactory] of undeployed) {
    const deployedFactory = await facetFactory.deploy();
    if (verbose) console.log(`${name} hash: ${deployedFactory.deployTransaction.hash}`);
    await deployedFactory.deployed()
    if (verify) {
      await run(`verify`, {
        address: deployedFactory.address
      });
    }
    const receipt = await deployedFactory.deployTransaction.wait()
    if (verbose) console.log(`${name} deploy gas used: ` + strDisplay(receipt.gasUsed))
    totalGasUsed = totalGasUsed.add(receipt.gasUsed)
    if (verbose) console.log(`${name} deployed: ${deployedFactory.address}`)
    if (verbose) console.log('--')
    const add = []
    const replace = []
    const selectors = selectorsToAdd[name] !== undefined ? selectorsToAdd[name] : getSelectors(deployedFactory)
    for (const selector of selectors) {
      if (!inFacets(selector, existingFacets)) {
        add.push(selector)
      } else {
        replace.push(selector)
      }
    }
    if (add.length > 0) {
      diamondCut.push([deployedFactory.address, FacetCutAction.Add, add])
    }
    if (replace.length > 0) {
      diamondCut.push([
        deployedFactory.address,
        FacetCutAction.Replace,
        replace
      ])
    }
  }
  if (verbose) {
    console.log('diamondCut arg:')
    console.log(diamondCut)
    console.log('------')
  }

  let functionCall = '0x'
  if (initFacetName !== undefined) {
    let initFacet
    for (const [name, deployedFactory] of deployed) {
      if (name === initFacetName) {
        initFacet = deployedFactory
        const receipt = await deployedFactory.deployTransaction.wait()
        if (verbose) console.log(`${name} deploy gas used: ` + strDisplay(receipt.gasUsed))
        totalGasUsed = totalGasUsed.add(receipt.gasUsed)
        break
      }
    }

    if (initFacetAddress !== ethers.constants.AddressZero) {
      initFacet = await ethers.getContractAt(initFacetName, initFacetAddress)
    } else if (!initFacet) {
      const InitFacet = await ethers.getContractFactory(initFacetName, account)
      initFacet = await InitFacet.deploy()
      await initFacet.deployed()
      if (verify) {
        await run(`verify`, {
          address: initFacet.address
        });
      }
      const receipt = await initFacet.deployTransaction.wait()
      if (verbose) console.log(`Init Diamond deploy gas used: ` + strDisplay(receipt.gasUsed))
      totalGasUsed = totalGasUsed.add(receipt.gasUsed)
      if (verbose) console.log('Deployed init facet: ' + initFacet.address)
    } else {
      if (verbose)console.log('Using init facet: ' + initFacet.address)
    }
    functionCall = initFacet.interface.encodeFunctionData('init', initArgs)
    if (verbose) console.log(`Function call: ${functionCall.toString().substring(0,100)}`)
    initFacetAddress = initFacet.address
  }
  let result;
  if (object) {
    dc = {
      diamondCut: diamondCut,
      initFacetAddress: initFacetAddress,
      functionCall: functionCall
    }
    const encodedDiamondCut = await diamondCutFacet.interface.encodeFunctionData('diamondCut', Object.values(dc))
    console.log(JSON.stringify(dc, null, 4))
    console.log("Encoded: -------------------------------------------------------------")
    console.log(encodedDiamondCut)
    const dcName = `diamondCut-${initFacetName}-${Math.floor(Date.now() / 1000)}-${facetNames.length}-facets.json`
    await fs.writeFileSync(`./diamondCuts/${dcName}`, JSON.stringify({diamondCut: dc, encoded: encodedDiamondCut }, null, 4));
    return dc
  }
  if (bip) {
    const governance = await ethers.getContractAt('GovernanceFacet', diamondAddress)
    result = await governance.connect(account).propose(diamondCut, initFacetAddress, functionCall, p);
  } else {
    result = await diamondCutFacet.connect(account).diamondCut(
      diamondCut,
      initFacetAddress,
      functionCall
    )
  }
  const receipt = await result.wait();
  totalGasUsed = totalGasUsed.add(receipt.gasUsed)
  if (verbose) {
    console.log('------')
    console.log('Upgrade transaction hash: ' + result.hash)
    console.log(`Diamond Cut Gas Used: ` + strDisplay(receipt.gasUsed));
    console.log('Total gas used: ' + strDisplay(totalGasUsed))
  }
  return result
}

exports.FacetCutAction = FacetCutAction
exports.upgrade = upgrade
exports.upgradeWithNewFacets = upgradeWithNewFacets
exports.getSelectors = getSelectors
exports.deployFacets = deployFacets
exports.deploy = deploy
exports.inFacets = inFacets
exports.upgrade = upgrade
exports.deployInitDiamond = deployInitDiamond
