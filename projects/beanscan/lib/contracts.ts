import { Contract } from 'ethers-multicall';
import { provider } from './provider';
import { Beanstalk, Beanstalk__factory } from '../generated';

const beanstalkAbi = require('../abi/Beanstalk.json');

const contracts = {
  beanstalk: Beanstalk__factory.connect('0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5', provider),
  multi: {
    beanstalk: new Contract('0xC1E088fC1323b20BCBee9bd1B9fC9546db5624C5', beanstalkAbi) as unknown as Beanstalk,
  }
};

export default contracts;