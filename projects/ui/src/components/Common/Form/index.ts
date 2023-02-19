import BigNumber from 'bignumber.js';
import { ERC20Token as ERC20TokenNew, NativeToken as NativeTokenNew } from '@beanstalk/sdk';
import { ERC20Token, NativeToken } from '~/classes/Token';
import { ClaimPlantAction } from '~/hooks/beanstalk/useClaimAndPlantActions';
import { QuoteHandlerResult } from '~/hooks/ledger/useQuote';
import { FarmToMode } from '~/lib/Beanstalk/Farm';
import { BalanceFrom } from './BalanceFromRow';

/**
 * 
 */
export type FormState = {
  /** */
  tokens: FormTokenState[];
  /** */
  approving?: FormApprovingState; 
}

export type FormStateNew = {
  tokens: FormTokenStateNew[];
  approving?: FormApprovingStateNew;
}

/// FIXME: use type composition instead of this
export type FormStateWithPlotSelect = FormState & {
  plot?: BigNumber;
}

/**
 * Fragment: A single Token stored within a form.
 */
export type FormTokenState = (
  /// Form inputs
  {
    /** The selected token. */
    token:      ERC20Token | NativeToken;
    /** The amount of the selected token, usually input by the user.
     * @value undefined if the input is empty */
    amount:     BigNumber | undefined;
  } 
  /// Quoting
  & {
    /** Whether we're currently looking up a quoted `amountOut` for this token. */
    quoting?:   boolean;
  } & Partial<QuoteHandlerResult>
);

/**
 * Fragment: A single Token stored within a form.
 * NOTE: Duplicated from FromTokenState but to use types from @beanstalk/sdk
 */
export type FormTokenStateNew = (
  {
    token:     ERC20TokenNew | NativeTokenNew;
    amount:    BigNumber | undefined;
  } & {
    quoting?:  boolean;
  } & Partial<QuoteHandlerResult>
)

// /** Some `amountOut` received for inputting `amount` of this token into a function. */
// amountOut?: BigNumber;
// /** Amount of ETH used in the transaction; applied to the `value` override. */
// value?:     ethers.BigNumber;
// /** The steps needed to convert `amount` -> `amountOut`. */
// steps?:     ChainableFunctionResult[];

export type FormApprovingState = {
  /** */
  contract: string;
  /** */
  token:    ERC20Token | NativeToken;
  /** */
  amount:   BigNumber;
}

export type FormApprovingStateNew = {
  contract: string;
  token:    ERC20TokenNew | NativeTokenNew;
  amount:   BigNumber;
}

export type PlotFragment = {
  /** The absolute index of the plot. @decimals 6 */
  index:  string    | null;
  /** The user's selected start position. @decimals 6 */
  start:  BigNumber | null;
  /** The user's selected end position. @decimals 6 */
  end:    BigNumber | null;
  /** end - start. @decimals 6 */
  amount: BigNumber | null;
}

export type SlippageSettingsFragment = {
  /** When performing a swap of some kind, set the slippage
   * value applied to all exchanges. */
  slippage: number;
}
export type PlotSettingsFragment = {
  /** Let the Farmer select the exact range from which their
   * Pods are being transferred, sold, etc. */
  showRangeSelect: boolean;
}

/**
 *
 */
export type BalanceFromFragment = {
  balanceFrom: BalanceFrom;
};

export type AdditionalBalanceFragment = {
  /** */
  additionMax: BigNumber;
  /** */
  additionApplied: BigNumber;
}

/**
 *
 */
export type FarmToModeFragment = {
  destination?: FarmToMode;
};

export type ClaimAndPlantFormState = {
  /**
   * actions to be performed with any given transaction (e.g. deposit, convert, harvest, etc). 
   * Possible Actions are [Claim, Harvest, Rinse, Mow, Plant, Enroot]
   */
  farmActions: {
    /**
     * The farm actions that can be performed.
     */
    options: ClaimPlantAction[];
    /**
     * actions that have been selected by the user.
     * NOTE: typically these are the actions that must be peformed BEFORE the user performs the 'main' action.
     * 
     */
    selected: ClaimPlantAction[];
    /**
     * 
     */
    additional: {
      /**
       * Any additional 'ClaimPlantAction's to perform that have been selected by the user.
       * NOTE:
       * the set of options for 'additional.selected' is the complement of 'farmActions.options'
       * For example, if 'farmActions.options' is defined as the set of [Claim, Harvest, Rinse],
       * the options for 'additional.selected' are the set of [Mow, Plant, Enroot]
       */
      selected: ClaimPlantAction[];
      /**
       * any additional ClaimPlantActions that are required to be performed if possible.
       * Ex: If the user is performing a silo deposit, the we required 'MOW' as well if grown stalk > 0
       */
      required?: ClaimPlantAction[];
    }
  };
} & BalanceFromFragment;

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
