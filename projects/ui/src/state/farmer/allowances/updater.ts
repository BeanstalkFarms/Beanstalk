import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import Token from '~/classes/Token';
import { toTokenUnitsBN } from '~/util';
import { getAccount } from '~/util/Account';
import { clearAllowances, UpdateAllowancePayload, updateAllowances } from './actions';
import { ZERO_BN } from '~/constants';

export function useFetchFarmerAllowances() {
  const dispatch = useDispatch();

  const fetch = useCallback((
    _account:   string,
    _contract:  string,
    _tokens:    Token | Token[]
  ) => {
    const account = getAccount(_account);
    if (_contract && account) {
      console.debug(`[farmer/allowances/useFetchAllowances] FETCH account = ${account} contract = ${_contract} token(s) = ${_tokens.toString()}`);
      return Promise.all(
        (Array.isArray(_tokens) ? _tokens : [_tokens])
          .map((token) =>
            token.getAllowance(account, _contract).then((result) => ({
              token,
              contract: _contract,
              allowance: result ? toTokenUnitsBN(result, token.decimals) : ZERO_BN,
            } as UpdateAllowancePayload))
          )
      ).then((_allowances) => {
        console.debug(`[farmer/allowances/useFetchAllowances] RESULT: ${_allowances.length} allowances`, _allowances);
        dispatch(updateAllowances(_allowances));
      });
    }
    return Promise.resolve();
  }, [dispatch]);
  
  const clear = useCallback(() => {
    console.debug('[farmer/allowances/useFetchAllowances] CLEAR');
    dispatch(clearAllowances());
  }, [dispatch]);

  return [fetch, clear] as const;
}
