import {
  BeanstalkSDK,
  FarmFromMode,
  FarmToMode,
  TokenValue,
} from '@beanstalk/sdk';
import { FarmInput } from '~/lib/Txn/types';
import { makeLocalOnlyStep } from '~/lib/Txn/util';

export default class ClaimAndDoX {
  constructor(
    private _sdk: BeanstalkSDK,
    private _totalClaimed: TokenValue,
    private _claimedBeansUsed: TokenValue,
    private _destination: FarmToMode
  ) {
    this._sdk = _sdk;
    if (_totalClaimed?.lt(_claimedBeansUsed || TokenValue.ZERO)) {
      throw new Error('Claimed amount is less than used amount');
    }

    this._totalClaimed = _totalClaimed;
    this._claimedBeansUsed = _claimedBeansUsed;
    this._destination = _destination;
  }

  get claimedBeansUsed() {
    return this._claimedBeansUsed;
  }

  get isUsingClaimed() {
    return this._claimedBeansUsed.gt(0);
  }

  get shouldTransfer() {
    const transferAmount = this._totalClaimed.sub(this._claimedBeansUsed);
    const isToExternal = this._destination === FarmToMode.EXTERNAL;
    return isToExternal && transferAmount.gt(0);
  }

  public getTransferStep(account: string) {
    if (!account) throw new Error('Signer not found');

    const transferAmount = this._totalClaimed.sub(this._claimedBeansUsed);
    const isToExternal = this._destination === FarmToMode.EXTERNAL;
    const shouldTransfer = isToExternal && transferAmount.gt(0);

    if (!shouldTransfer) return undefined;

    const inputs: FarmInput[] = [];

    inputs.push(
      makeLocalOnlyStep({
        name: 'pre-transfer',
        amount: {
          overrideAmount: transferAmount,
        },
      })
    );

    inputs.push({
      input: new this._sdk.farm.actions.TransferToken(
        this._sdk.tokens.BEAN.address,
        account,
        FarmFromMode.INTERNAL,
        FarmToMode.EXTERNAL
      ),
    });

    return inputs;
  }
}
