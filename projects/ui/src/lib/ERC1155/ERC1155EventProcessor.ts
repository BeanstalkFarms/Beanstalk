import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import { TransferBatchEvent, TransferSingleEvent } from '~/generated/Beanstalk/BeanstalkFertilizer';
import { decimalBN, Event } from '~/lib/Beanstalk/EventProcessor';

export default class ERC1155EventProcessor {
  static SUPPORTED_EVENTS = new Set([
    'TransferSingle',
    'TransferBatch',
  ] as const);

  account : string;
  
  decimals: number;

  tokens : { [id: string] : BigNumber }

  constructor(account: string, decimals: number) {
    this.account  = account.toLowerCase();
    this.decimals = decimals;
    this.tokens   = {};
  }

  ingest<T extends Event>(event: T) {
    if (!event.event) { return; }
    if (!ERC1155EventProcessor.SUPPORTED_EVENTS.has(event.event as any)) { return; }
    // @ts-ignore
    return this[event.event](event as any);
  }

  ingestAll<T extends Event>(events: T[]) {
    events.forEach((event) => this.ingest(event));
    return this.data();
  }

  data() {
    return {
      tokens: this.tokens,
    };
  }

  _transfer(
    from:   string,
    to:     string,
    id:     string,
    value:  ethers.BigNumber
  ) {
    if (from === to) return;
    const valueBN = decimalBN(value, this.decimals);

    /// Sent token
    if (from === this.account) {
      if (!this.tokens[id] || this.tokens[id].lt(valueBN)) throw new Error('ERC1155: Value is greater than known balance');
      this.tokens[id] = this.tokens[id].minus(valueBN);
      if (this.tokens[id].eq(0)) delete this.tokens[id];
    }

    /// Received token
    else if (to === this.account) {
      this.tokens[id] = (
        this.tokens[id]?.plus(valueBN)
        || valueBN
      );
    }
  }

  TransferSingle(event: TransferSingleEvent) {
    console.debug('[ERC1155EventProcessor] TransferSingle', event);
    this._transfer(
      event.args.from.toLowerCase(),
      event.args.to.toLowerCase(),
      event.args.id.toString(),
      event.args.value,
    );
  }

  TransferBatch(event: TransferBatchEvent) {
    console.debug('[ERC1155EventProcessor] TransferBatch', event);
    event.args.ids.forEach((id, index) => {
      this._transfer(
        event.args.from.toLowerCase(),
        event.args.to.toLowerCase(),
        id.toString(),
        event.args.values[index],
      );
    });
  }
}
