import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Switch, Typography } from '@mui/material';
import { useFormikContext } from 'formik';
import AddIcon from '@mui/icons-material/Add';
import BigNumber from 'bignumber.js';
import { ethers } from 'ethers';
import Row from '../../Row';
import SelectionAccordion from '~/components/Common/Accordion/SelectionAccordion';
import { FormTxnsFormState } from '..';
import useToggle from '~/hooks/display/useToggle';
import useTimedRefresh from '~/hooks/app/useTimedRefresh';

import FormTxnOptionCard from '../FormTxnOptionCard';
import useFarmerFormTxnSummary from '~/hooks/farmer/form-txn/useFarmerFormTxnsSummary';
import useFormTxnContext from '~/hooks/sdk/useFormTxnContext';
import { FormTxn, FormTxnBundler } from '~/lib/Txn';

type Props = {
  filter?: FormTxn[];
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

const AdditionalTxnsAccordion: React.FC<Props> = ({ filter }) => {
  /// FormTxns
  const { txnBundler } = useFormTxnContext();
  const { summary } = useFarmerFormTxnSummary();

  /// Formik
  const { values, setFieldValue } = useFormikContext<FormTxnsFormState>();
  const { farmActions } = values;

  ///
  const formPreset = values.farmActions.preset;
  const excluded = values.farmActions.exclude;

  ///
  const allOptions = useMemo(() => {
    const preset = FormTxnBundler.presets[formPreset];
    const removeSet = new Set([...(excluded || []), ...(filter || [])]);

    return [...preset.secondary]
      .filter((opt) => !removeSet.has(opt) && summary[opt].enabled)
      .sort((a, b) => sortOrder[a] - sortOrder[b]);
  }, [excluded, filter, formPreset, summary]);

  const impliedOptions = useMemo(() => {
    const _implied = new Set(values.farmActions.implied || []);
    [..._implied].forEach((opt) => {
      !summary[opt].enabled && _implied.delete(opt);
    });
    return _implied;
  }, [summary, values.farmActions.implied]);

  /// State
  const [local, setLocal] = useState<Set<FormTxn>>(impliedOptions);
  const [hovered, setHovered] = useState<Set<FormTxn>>(new Set());
  const [gasEstimates, setGasEstimates] = useState<FormTxnGasResult>({});
  const [open, show, hide] = useToggle();

  const allToggled = useMemo(() => {
    if (allOptions.length === 0) return false;
    return allOptions.every((opt) => local.has(opt));
  }, [allOptions, local]);

  /// Handlers
  // handle toggling of individual options
  const handleOnToggle = (item: FormTxn) => {
    const copy = new Set([...local]);
    const affected = new Set([
      item,
      ...([FormTxnBundler.implied[item]] || []),
    ] as FormTxn[]);

    if (copy.has(item)) {
      /// check if other items need the affected items
      const filtered = new Set([...copy]);
      affected.forEach((_affected) => {
        filtered.delete(_affected);
      });

      [...filtered].forEach((remaining) => {
        ([FormTxnBundler.implied[remaining]] || []).forEach((k) => {
          if (k && affected.has(k)) {
            affected.delete(k);
          }
        });
      });

      /// remove the item and all it's implied unless it is required
      affected.forEach((v) => {
        !impliedOptions.has(v) && copy.delete(v);
      });
    } else {
      affected.forEach((v) => {
        allOptions.includes(v) && copy.add(v);
      });
    }

    setLocal(copy);
    setFieldValue('farmActions.secondary', Array.from(copy));
  };

  const handleOnToggleAll = useCallback(() => {
    const newState = new Set(allToggled ? impliedOptions : allOptions);
    setLocal(newState);
    setFieldValue('farmActions.secondary', newState);
  }, [allOptions, allToggled, impliedOptions, setFieldValue]);

  const handleMouseOver = useCallback(
    (item: FormTxn) => {
      const copy = new Set<FormTxn>();
      const affected = [...([FormTxnBundler.implied[item]] || [])] as FormTxn[];
      copy.add(item);
      affected.forEach((option) => {
        !local.has(option) && copy.add(option);
      });
      setHovered(copy);
    },
    [local]
  );

  const handleMouseLeave = useCallback(() => {
    setHovered(new Set<FormTxn>());
  }, []);

  /// handle gas estimates
  const estimateGas = useCallback(async () => {
    if (!allOptions.length || !open) return;
    console.debug(`[FormTxnsOptions] estimating Gas for ${allOptions} txns`);
    const _optionKeys = [...allOptions];
    const optionKeys = _optionKeys.filter((o) => !impliedOptions.has(o));
    const estimates = await Promise.all(
      optionKeys.map((opt) => {
        const fStep = txnBundler.getFarmStep(opt);
        if (fStep) {
          return fStep.estimateGas();
        }
        return Promise.resolve(ethers.BigNumber.from('0'));
      })
    ).then((results) =>
      results.reduce<FormTxnGasResult>(
        (prev, curr, i) => ({
          ...prev,
          [optionKeys[i]]: new BigNumber(curr.toString()),
        }),
        {}
      )
    );
    console.debug(`[FormTxnsOptions] gas result: `, estimates);

    setGasEstimates(estimates);
  }, [allOptions, impliedOptions, open, txnBundler]);

  useTimedRefresh(estimateGas, 2 * 1000, open, false);

  /// Effects
  // reset the local state if the form resets
  useEffect(() => {
    if (!farmActions.secondary) {
      setLocal(impliedOptions);
    }
  }, [farmActions.secondary, impliedOptions]);

  if (!allOptions?.length) return null;

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
        <Row width="100%" justifyContent="space-between">
          <Typography color="text.secondary">Claim All</Typography>
          <Switch
            checked={allToggled}
            onClick={handleOnToggleAll}
            disabled={allOptions.length === 0}
          />
        </Row>
      }
      options={allOptions}
      selected={local}
      onToggle={handleOnToggle}
      render={(item, selected) => (
        <FormTxnOptionCard
          key={item}
          option={item}
          summary={summary[item]}
          selected={selected}
          required={impliedOptions.has(item)}
          gas={gasEstimates[item] || undefined}
          isHovered={hovered.has(item)}
          onMouseOver={() => handleMouseOver(item)}
          onMouseLeave={handleMouseLeave}
        />
      )}
    />
  );
};

export default React.memo(AdditionalTxnsAccordion);
