import React from 'react';
import { Stack, styled, Typography } from '@mui/material';
import { ERC20Token } from '~/classes/Token';
import {
  BEAN,
  BEAN_CRV3_LP,
  UNRIPE_BEAN,
  UNRIPE_BEAN_CRV3,
} from '~/constants/tokens';
import earnBeansImg from '~/img/beanstalk/silo/edu/earnBeansImg.png';
import depositBeanImg from '~/img/beanstalk/silo/edu/depositBeanImg.svg';
import depositBean3crvImg from '~/img/beanstalk/silo/edu/depositBean3crvImg.svg';
import depositUrBean3crvImg from '~/img/beanstalk/silo/edu/depositUrBean3crvImg.svg';
import depositUrBeanImg from '~/img/beanstalk/silo/edu/depositUrBeanImg.svg';
import earnStalkAndSeedsImg from '~/img/beanstalk/silo/edu/earnStalkAndSeedsImg.svg';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import Carousel from '~/components/Common/Carousel/Carousel';
import EmbeddedCard from '~/components/Common/EmbeddedCard';

import { FC } from '~/types';

const depositCardContentByToken = {
  [BEAN[1].address]: {
    img: depositBeanImg,
  },
  [BEAN_CRV3_LP[1].address]: {
    img: depositBean3crvImg,
  },
  [UNRIPE_BEAN[1].address]: {
    img: depositUrBeanImg,
  },
  [UNRIPE_BEAN_CRV3[1].address]: {
    img: depositUrBean3crvImg,
  },
};

const useCardContentWithToken = (token: ERC20Token) => [
  {
    title: `Deposit ${token.name}`,
    texts: [
      `Use the form to Deposit ${token.symbol} into the Silo.`,
      `Beanstalk allows you to use ${
        token.isUnripe ? token.symbol : 
          token.symbol === 'BEAN' 
            ? 'BEAN or ETH'
            : 'BEAN, ETH, 3CRV, DAI, USDC, or USDT'
      } from your wallet or Farm balance to Deposit ${token.symbol} into the Silo.${
        token.isUnripe ? '' : ` If you aren't using ${token.symbol}, the UI will swap${
          token.isLP ? ', add liquidity, and Deposit the LP token' : ' and Deposit'
        } for you in one transaction.`
      }`
    ],
    imageSrc: depositCardContentByToken[token.address]?.img || depositBeanImg,
  },
  {
    title: 'Receive Stalk and Seeds for your Deposit',
    texts: [
      'Stalk entitles holders to participate in Beanstalk governance and earn a portion of Bean mints.',
      'Seeds yield 1/10000 new Stalk every Season.',
    ],
    imageSrc: earnStalkAndSeedsImg,
  },
  {
    title: 'Earn Beans',
    texts: [
      'Every Season that Beans are minted, receive a share of the new Beans based on your percentage ownership of Stalk.',
      'You can claim your Silo Rewards on the main Silo page.',
    ],
    imageSrc: earnBeansImg, // Made this one a PNG because it contains 4 BeaNFTs which are too big when base64 encoded in an SVG.
  },
];

const ImageWrapper = styled(Stack)(({ theme }) => ({
  justifyContent: 'flex-end',
  alignItems: 'center',
  background: BeanstalkPalette.blue,
  width: '100%',
  height: '300px',
  [theme.breakpoints.down('md')]: { height: '250px !important' },
}));

const InfoContent = styled(Stack)(({ theme }) => ({
  width: '100%',
  padding: '20px',
  background: BeanstalkPalette.white,
  [theme.breakpoints.up('md')]: {
    // borderLeft: `${theme.palette.} 1px solid`,
    borderLeft: '1px solid white',
    maxWidth: '40%',
  },
  [theme.breakpoints.down('md')]: {
    borderTop: '1px solid white',
  },
  [theme.breakpoints.between('sm', 'md')]: {
    height: '200px',
  },
  [theme.breakpoints.down('sm')]: {
    height: '285px',
  },
}));

const CarouselCard = styled(EmbeddedCard)(({ theme }) => ({
  // heights are defined here otherwise layout jumps occur during animation
  overflow: 'hidden',
  [theme.breakpoints.up('md')]: { height: '300px' },
  [theme.breakpoints.between('sm', 'md')]: { height: '450px' },
  [theme.breakpoints.down('sm')]: { height: '535px' },
}));

const SiloCarousel: FC<{ token: ERC20Token }> = ({ token }) => {
  const content = useCardContentWithToken(token);

  return (
    <CarouselCard>
      <Carousel total={content.length}>
        <Stack direction={{ xs: 'column', md: 'row' }}>
          <Carousel.Elements
            elements={content.map(({ imageSrc }, i) => (
              <ImageWrapper key={`${i}-img`}>
                <img
                  src={imageSrc}
                  alt=""
                  css={{ objectFit: 'cover', height: '100%' }}
                />
              </ImageWrapper>
            ))}
          />
          <InfoContent>
            <Stack sx={{ pb: '20px' }}>
              <Carousel.Elements
                duration={300}
                disableSlide
                elements={content.map(({ title, texts }, k) => (
                  <React.Fragment key={`${k}-info`}>
                    <Typography color="text.primary">
                      {title}
                    </Typography>
                    <Stack sx={{ whiteSpace: 'pre-wrap' }}>
                      {texts.map((text, i) => (
                        <Typography
                          variant="bodySmall"
                          color="text.secondary"
                          key={i}
                        >
                          {`${text}\n\n`}
                        </Typography>
                      ))}
                    </Stack>
                  </React.Fragment>
                ))}
              />
            </Stack>
          </InfoContent>
        </Stack>
        <Carousel.Pagination
          sx={{
            position: 'absolute',
            bottom: '15px',
            right: '20px',
            width: 'calc(100% - 42px)',
            // don't use mui bp here b/c breakpoints don't pass
            '@media(min-width: 800px)': { width: 'calc(40% - 42px)' },
          }}
        />
      </Carousel>
    </CarouselCard>
  );
};

export default SiloCarousel;
