import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CircularProgress, Stack, Typography } from '@mui/material';
import usePodListing from '~/hooks/beanstalk/usePodListing';
import FillListingForm from '~/components/Market/PodsV2/Actions/Buy/FillListingForm';
import { bigNumberResult, displayBN, displayFullBN } from '~/util';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import StatHorizontal from '~/components/Common/StatHorizontal';
import Row from '~/components/Common/Row';
import TokenIcon from '~/components/Common/TokenIcon';
import FarmerChip from '~/components/Common/FarmerChip';
import { BEAN, PODS } from '~/constants/tokens';

const FillListing: React.FC<{}> = () => {
  const { listingID } = useParams<{ listingID: string }>();
  const { data: podListing, loading, error } = usePodListing(listingID);
  const beanstalk = useBeanstalkContract();
  
  /// Verify that this listing is still live via the contract.
  const [listingValid, setListingValid] = useState<null | boolean>(null);
  useEffect(() => {
    if (listingID) {
      (async () => {
        try {
          const _listing = await beanstalk.podListing(listingID.toString()).then(bigNumberResult);
          console.debug('[pages/listing] listing = ', _listing);
          setListingValid(_listing?.gt(0));
        } catch (e) {
          console.error(e);
          setListingValid(false);
        }
      })();
    }
  }, [beanstalk, listingID]);

  /// Loading isn't complete until listingValid is set
  if (loading || listingValid === null) {
    return (
      <Stack height={200} alignItems="center" justifyContent="center">
        <CircularProgress color="primary" />
      </Stack>
    );
  }
  if (error) {
    return (
      <Stack height={200} alignItems="center" justifyContent="center">
        <Typography>{error.message.toString()}</Typography>
      </Stack>
    );
  }
  if (!podListing || !listingValid) {
    return (
      <Stack height={200} alignItems="center" justifyContent="center">
        <Typography>Listing not found.</Typography>
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {/* Listing Details */}
      <Stack px={0.5} gap={0.75}>
        {/* add margin right of -0.5 to offset padding from farmer chip */}
        <StatHorizontal label="Seller" maxHeight={20} sx={{ mr: -0.5 }}>
          <FarmerChip account={podListing.account} />
        </StatHorizontal>
        <StatHorizontal label="Place in Line">
          {displayBN(podListing.placeInLine)}
        </StatHorizontal>
        <StatHorizontal label="Pods Available">
          <Row gap={0.25}>
            <TokenIcon token={PODS} />{' '}
            {displayFullBN(podListing.remainingAmount, 2, 0)}
          </Row>
        </StatHorizontal>
        <StatHorizontal label="Price per Pod">
          <Row gap={0.25}>
            <TokenIcon token={BEAN[1]} />{' '}
            {displayFullBN(podListing.pricePerPod, 4, 2)}
          </Row>
        </StatHorizontal>
        <StatHorizontal label="Beans to Fill">
          <Row gap={0.25}>
            <TokenIcon token={BEAN[1]} />{' '}
            {displayFullBN(podListing.remainingAmount.times(podListing.pricePerPod), 2, 0)}
          </Row>
        </StatHorizontal>
      </Stack>
      {/* Form */}
      <FillListingForm podListing={podListing} />
    </Stack>
  );
};

export default FillListing;
