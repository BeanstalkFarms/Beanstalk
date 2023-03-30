import { Token } from '@beanstalk/sdk';
import { useFormikContext } from 'formik';
import { useState } from 'react';
import { FormTxnsFormState } from '~/components/Common/Form';
import useDeepCompareEffect from '../display/useDeepCompareEffect';

export default function useResetFormFarmActions(
  token: Token,
  defaultState: FormTxnsFormState['farmActions']
) {
  const [cachedToken, setCachedToken] = useState<Token>(token);

  const { setFieldValue } = useFormikContext<FormTxnsFormState>();

  useDeepCompareEffect(() => {
    console.debug(
      '[useResetFormFarmActions]: token changed from',
      cachedToken.symbol,
      '=>',
      token.symbol,
      "resetting form's farmActions"
    );
    setCachedToken(token);
    setFieldValue('farmActions', defaultState);
  }, [cachedToken, token, defaultState]);
}
