import BigNumber from 'bignumber.js';
import {
  FarmToMode,
  ERC20Token as ERC20TokenNew,
  NativeToken as NativeTokenNew,
} from '@beanstalk/sdk';
import { ERC20Token, NativeToken } from '~/classes/Token';
import { QuoteHandlerResult } from '~/hooks/ledger/useQuote';
import { BalanceFrom } from './BalanceFromRow';
import { QuoteHandlerResultNew } from '~/hooks/ledger/useQuoteWithParams';
import { FormTxnBundlerInterface } from '~/lib/Txn';

/**
 *
 */
export type FormState = {
  /** */
  tokens: FormTokenState[];
  /** */
  approving?: FormApprovingState;
};

export type FormStateNew = {
  tokens: FormTokenStateNew[];
  approving?: FormApprovingStateNew;
};

/// FIXME: use type composition instead of this
export type FormStateWithPlotSelect = FormState & {
  plot?: BigNumber;
};

/**
 * Fragment: A single Token stored within a form.
 */
export type FormTokenState =
  /// Form inputs
  {
    /** The selected token. */
    token: ERC20Token | NativeToken;
    /** The amount of the selected token, usually input by the user.
     * @value undefined if the input is empty */
    amount: BigNumber | undefined;
  } & {
    /// Quoting
    /** Whether we're currently looking up a quoted `amountOut` for this token. */
    quoting?: boolean;
  } & Partial<QuoteHandlerResult>;

/**
 * Fragment: A single Token stored within a form.
 * NOTE: Duplicated from FromTokenState but to use types from @beanstalk/sdk
 */
export type FormTokenStateNew = {
  token: ERC20TokenNew | NativeTokenNew;
  amount: BigNumber | undefined;
  maxAmountIn?: BigNumber | undefined;
} & {
  quoting?: boolean;
} & Partial<QuoteHandlerResultNew>;

export type FormApprovingState = {
  /** */
  contract: string;
  /** */
  token: ERC20Token | NativeToken;
  /** */
  amount: BigNumber;
};

export type FormApprovingStateNew = {
  contract: string;
  token: ERC20TokenNew | NativeTokenNew;
  amount: BigNumber;
};

export type PlotFragment = {
  /** The absolute index of the plot. @decimals 6 */
  index: string | null;
  /** The user's selected start position. @decimals 6 */
  start: BigNumber | null;
  /** The user's selected end position. @decimals 6 */
  end: BigNumber | null;
  /** end - start. @decimals 6 */
  amount: BigNumber | null;
};

export type SlippageSettingsFragment = {
  /** When performing a swap of some kind, set the slippage
   * value applied to all exchanges. */
  slippage: number;
};
export type PlotSettingsFragment = {
  /** Let the Farmer select the exact range from which their
   * Pods are being transferred, sold, etc. */
  showRangeSelect: boolean;
};

/**
 *
 */
export type BalanceFromFragment = {
  balanceFrom: BalanceFrom;
};

/**
 *
 */
export type FarmToModeFragment = {
  destination?: FarmToMode;
};

export type FormTxnsFormState = {
  /**
   * actions added in conjunction to an arbitrary txn (e.g. deposit, convert, harvest, etc).
   */
  farmActions: FormTxnBundlerInterface;
};

export type ClaimBeansFormState = {
  claimableBeans: FormTokenStateNew;
};

// ----------------------------------------------------------------------

// Settings
export { default as SettingSwitch } from './SettingSwitch';
export { default as SettingInput } from './SettingInput';
export { default as SmartSubmitButton } from './SmartSubmitButton';

// Fields
export { default as TokenQuoteProvider } from './TokenQuoteProvider';
export { default as TokenInputField } from './TokenInputField';
export { default as TokenOutputField } from './TokenOutputField';
export { default as TokenAdornment } from './TokenAdornment';
export { default as RadioCardField } from './RadioCardField';

// Dialogs
export { default as TokenSelectDialog } from './TokenSelectDialog';

// Modules
export { default as TxnPreview } from './TxnPreview';
export { default as TxnSeparator } from './TxnSeparator';
export { default as TxnSettings } from './TxnSettings';
