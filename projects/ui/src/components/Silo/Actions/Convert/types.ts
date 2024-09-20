import { BeanstalkSDK, ERC20Token, NativeToken, Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { FormikHelpers, FormikProps } from 'formik';
import { FormStateNew, FormTxnsFormState } from '~/components/Common/Form';
import usePlantAndDoX from '~/hooks/farmer/form-txn/usePlantAndDoX';
import { FarmerSilo } from '~/state/farmer/silo';

// ---------- FORMIK ----------
export type ConvertFormValues = FormStateNew & {
  settings: {
    slippage: number;
  };
  maxAmountIn: BigNumber | undefined;
  tokenOut: Token | undefined;
} & FormTxnsFormState;

export type ConvertFormSubmitHandler = (
  values: ConvertFormValues,
  formActions: FormikHelpers<ConvertFormValues>
) => Promise<void>;

export type ConvertQuoteHandlerParams = {
  slippage: number;
  isConvertingPlanted: boolean;
};

// ---------- COMPONENT ----------

type BaseConvertFormikProps = FormikProps<ConvertFormValues>;

// Base Props
export interface ConvertProps {
  fromToken: ERC20Token;
}

export interface BaseConvertFormProps
  extends ConvertProps,
    BaseConvertFormikProps {
  /** List of tokens that can be converted to. */
  tokenList: (ERC20Token | NativeToken)[];
  /** Farmer's silo balances */
  siloBalances: FarmerSilo['balances'];
  currentSeason: BigNumber;
  /** other */
  sdk: BeanstalkSDK;
  plantAndDoX: ReturnType<typeof usePlantAndDoX>;
}
