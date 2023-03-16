import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Switch, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import AddIcon from '@mui/icons-material/Add';
import BigNumber from 'bignumber.js';
import Row from '../Row';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';
import { FormTxnsFormState } from '.';
import useToggle from '~/hooks/display/useToggle';
import useTimedRefresh from '~/hooks/app/useTimedRefresh';
import { FormTxn, FormTxnBuilderPresets } from '~/util/FormTxns';
import FormTxnOptionCard from './FormTxnOptionCard';
import useFarmerFormTxns from '~/hooks/farmer/form-txn/useFarmerFormTxns';
import useFarmerFormTxnSummary from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';

type Props = {
  disabledActions?: {
    action: FormTxn;
    reason: string;
  }[];
};

type FormTxnGasResult = { [key in FormTxn]?: BigNumber };

const sortOrder: { [key in FormTxn]: number } = {
  [FormTxn.MOW]: 0,
  [FormTxn.PLANT]: 1,
  [FormTxn.ENROOT]: 2,
  [FormTxn.CLAIM]: 3,
  [FormTxn.HARVEST]: 4,
  [FormTxn.RINSE]: 5,
};

const FormTxnsSecondaryOptions: React.FC<Props> = ({ disabledActions }) => {
  /// Helpers
  const { getEstimateGas } = useFarmerFormTxns();
  const { summary } = useFarmerFormTxnSummary();

  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();
  const { farmActions } = values;

  const allOptions = useMemo(() => {
    const { exclude } = farmActions;
    const preset = FormTxnBuilderPresets[farmActions.preset];
    const _options = [...preset.secondary].filter(
      (opt) => !exclude?.includes(opt)
    );
    const sortedOptions = _options.sort((a, b) => sortOrder[a] - sortOrder[b]);
    return sortedOptions;
  }, [farmActions]);

  const disabledOptions = useMemo(() => {
    const _disabled = new Map<FormTxn, string>(
      disabledActions?.map((datum) => [datum.action, datum.reason]) || []
    );
    allOptions.forEach((opt) => {
      if (!summary[opt].enabled) {
        _disabled.set(opt, '');
      }
    });

    return _disabled;
  }, [allOptions, disabledActions, summary]);

  const enabledOptions = useMemo(() => {
    const _enabled = allOptions.filter(
      (opt) => summary[opt].enabled && !disabledOptions.has(opt)
    );
    return new Set(_enabled);
  }, [allOptions, disabledOptions, summary]);

  const impliedOptions = useMemo(() => {
    const _implied = new Set<FormTxn>(farmActions.implied || []);
    allOptions.forEach((opt) => {
      if (disabledOptions.has(opt)) {
        _implied.delete(opt);
      }
    });
    return _implied;
  }, [allOptions, disabledOptions, farmActions.implied]);

  /// State
  const [local, setLocal] = useState<Set<FormTxn>>(impliedOptions);
  const [hovered, setHovered] = useState<Set<FormTxn>>(new Set());
  const [gasEstimates, setGasEstimates] = useState<FormTxnGasResult>({});
  const [open, show, hide] = useToggle();

  const allToggled = useMemo(() => {
    if (enabledOptions.size <= 1) return false;

    return [...enabledOptions].every((opt) => local.has(opt));
  }, [enabledOptions, local]);

  /// Handlers
  // handle toggling of individual options
  const handleOnToggle = (item: FormTxn) => {
    const copy = new Set([...local]);
    const affected = [item, ...summary[item].implied];

    if (copy.has(item)) {
      affected.forEach((v) => {
        !impliedOptions.has(v) && copy.delete(v);
      });
    } else {
      affected.forEach((v) => {
        enabledOptions.has(v) && copy.add(v);
      });
    }

    setLocal(copy);
    setFieldValue('farmActions.secondary', [...copy]);
  };

  //
  const handleOnToggleAll = () => {
    const newState = new Set([
      ...(allToggled ? impliedOptions : enabledOptions),
    ]);
    setLocal(newState);
    setFieldValue('farmActions.secondary', newState);
  };

  const handleMouseEvent = (item: FormTxn, isRemoving: boolean) => {
    const copy = new Set([...hovered]);
    const affected = [item, ...summary[item].implied];
    if (isRemoving) {
      affected.forEach((option) => {
        if (!impliedOptions.has(option)) {
          copy.delete(option);
        }
      });
    } else {
      affected.forEach((option) => {
        if (enabledOptions.has(option) && !local.has) {
          copy.add(option);
        }
      });
    }
    if (copy.size !== hovered.size) {
      setHovered(copy);
    }
  };

  /// handle gas estimates
  const estimateGas = useCallback(async () => {
    if (!enabledOptions.size || !open) return;

    const optionKeys = [...enabledOptions];
    const estimates = await Promise.all(
      optionKeys.map((opt) => getEstimateGas(opt)())
    ).then((results) =>
      results.reduce<FormTxnGasResult>(
        (prev, curr, i) => ({
          ...prev,
          [optionKeys[i]]: new BigNumber(curr.toString()),
        }),
        {}
      )
    );

    setGasEstimates(estimates);
  }, [enabledOptions, getEstimateGas, open]);

  useTimedRefresh(estimateGas, 2 * 1000, open);

  /// Effects
  // reset the local state if the form resets
  useEffect(() => {
    if (!farmActions.secondary) {
      setLocal(impliedOptions);
      // setFieldValue('farmActions.secondary', []);
    }
  }, [farmActions.secondary, impliedOptions]);

  console.log('local: ', local);

  return (
    <SelectionAccordion<FormTxn>
      open={open}
      onChange={open ? hide : show}
      title={
        <Row gap={0.5}>
          <AddIcon fontSize="small" color="primary" />
          <Typography color="primary.main">
            Add additional transactions to save gas
          </Typography>
        </Row>
      }
      subtitle={
        <Row
          width="100%"
          justifyContent="space-between"
          // We add a negative margin b/c the MUI switch component has padding of 12px, and
          // removing the padding from the switch component causes unexpected behavior
          // sx={{ my: '-12px', boxSizing: 'border-box' }}
        >
          <Typography color="text.secondary">Claim All</Typography>
          <Switch
            checked={allToggled}
            onClick={handleOnToggleAll}
            disabled={enabledOptions.size <= 1}
          />
        </Row>
      }
      options={allOptions}
      selected={local}
      onToggle={handleOnToggle}
      render={(item, selected) => (
        <FormTxnOptionCard
          option={item}
          disabled={disabledOptions.has(item)}
          disabledMessage={disabledOptions.get(item)}
          summary={summary[item]}
          selected={selected}
          required={impliedOptions.has(item)}
          gas={gasEstimates[item] || undefined}
          isHovered={hovered.has(item)}
          onMouseOver={() => handleMouseEvent(item, false)}
          onMouseLeave={() => handleMouseEvent(item, true)}
        />
      )}
    />
  );
};

export default FormTxnsSecondaryOptions;
