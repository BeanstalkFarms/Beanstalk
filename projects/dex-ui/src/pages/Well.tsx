import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPrice } from "src/utils/price/usePrice";
import useSdk from "src/utils/sdk/useSdk";
import { TokenValue } from "@beanstalk/sdk";
import { BodyL, BodyS, BodyXS, TextNudge } from "src/components/Typography";
import styled from "styled-components";
import { Title } from "src/components/PageComponents/Title";
import { Page } from "src/components/Page";
import { TokenLogo } from "src/components/TokenLogo";
import { Reserves } from "src/components/Well/Reserves";
import { LiquidityBox } from "src/components/Well/LiquidityBox";
import { Button } from "src/components/Swap/Button";
import { LearnYield } from "src/components/Well/LearnYield";
import { Item, Row } from "src/components/Layout";
import { LearnWellFunction } from "src/components/Well/LearnWellFunction";
import { LearnPump } from "src/components/Well/LearnPump";
import { ChartSection } from "src/components/Well/Chart/ChartSection";
import { TabButton } from "src/components/TabButton";
import { OtherSection } from "src/components/Well/OtherSection";
import { WellHistory } from "src/components/Well/Activity/WellHistory";
import { ChevronDown } from "src/components/Icons";
import { ImageButton } from "src/components/ImageButton";
import { mediaQuery, size } from "src/breakpoints";
import { Error } from "src/components/Error";
import { useWellWithParams } from "src/wells/useWellWithParams";
import { LoadingItem } from "src/components/LoadingItem";
import { LoadingTemplate } from "src/components/LoadingTemplate";
import { WellYieldWithTooltip } from "src/components/Well/WellYieldWithTooltip";
import { useIsMobile } from "src/utils/ui/useIsMobile";
import { useLagLoading } from "src/utils/ui/useLagLoading";
import { useBeanstalkSiloAPYs } from "src/wells/useBeanstalkSiloAPYs";
import { useMultiFlowPumpTWAReserves } from "src/wells/useMultiFlowPumpTWAReserves";

export const Well = () => {
  const { well, loading: dataLoading, error } = useWellWithParams();
  const { isLoading: apysLoading } = useBeanstalkSiloAPYs();

  const { isLoading: twaLoading, getTWAReservesWithWell } = useMultiFlowPumpTWAReserves();

  const loading = useLagLoading(dataLoading || apysLoading || twaLoading);

  const sdk = useSdk();
  const navigate = useNavigate();
  const [prices, setPrices] = useState<(TokenValue | null)[]>([]);
  const [wellFunctionName, setWellFunctionName] = useState<string | undefined>("-");
  const isMobile = useIsMobile();

  const [tab, setTab] = useState(0);
  const showTab = useCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>, i: number) => {
    (e.target as HTMLElement).blur();
    setTab(i);
  }, []);

  console.log("aquifer address: ", well?.aquifer?.address);

  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open]);

  useEffect(() => {
    if (!well?.tokens) return;

    const run = async () => {
      if (well.tokens) {
        const prices = await Promise.all(well.tokens.map((t) => getPrice(t, sdk)));
        setPrices(prices);
      }

      if (well.wellFunction) {
        const _wellName = await well.wellFunction.contract.name();
        setWellFunctionName(_wellName);
      }
    };

    run();
  }, [sdk, well]);

  const title = (well?.tokens ?? []).map((t) => t.symbol).join("/");
  const logos: ReactNode[] = (well?.tokens || []).map((token) => <TokenLogo token={token} size={48} mobileSize={24} key={token.symbol} />);

  const reserves = (well?.reserves ?? []).map((amount, i) => {
    const token = well!.tokens![i];
    const price = prices[i];

    return {
      token,
      amount,
      dollarAmount: price ? amount.mul(price) : null,
      percentage: TokenValue.ZERO
    };
  });
  const totalUSD = reserves.reduce((total, r) => total.add(r.dollarAmount ?? TokenValue.ZERO), TokenValue.ZERO);

  reserves.forEach((reserve) => {
    reserve.percentage = reserve.dollarAmount && totalUSD.gt(TokenValue.ZERO) ? reserve.dollarAmount.div(totalUSD) : TokenValue.ZERO;
  });

  const twaReserves = useMemo(() => getTWAReservesWithWell(well), [well, getTWAReservesWithWell]);

  const goLiquidity = () => navigate(`./liquidity`);

  const goSwap = () =>
    well && well.tokens ? navigate(`../swap?fromToken=${well.tokens[0].symbol}&toToken=${well.tokens[1].symbol}`) : null;

  // Code below detects if the component with the Add/Remove Liq + Swap buttons is sticky
  const [isSticky, setIsSticky] = useState(false);

  const callbackFunction = (entries: any) => {
    const [entry] = entries;
    setIsSticky(!entry.isIntersecting); // Not sure why inverting isIntersecting gives me the desired behaviour
  };

  const observer = useRef<IntersectionObserver | null>();
  const containerRef = useCallback((node: any) => {
    if (node === null) return;

    const options = {
      root: null,
      rootMargin: "56px",
      threshold: 1.0
    };

    if (!observer.current) {
      observer.current = new IntersectionObserver(callbackFunction, options);
    }

    observer.current.observe(node);
  }, []);

  useEffect(
    () => () => {
      if (observer.current) observer.current.disconnect();
    },
    []
  );
  // Code above detects if the component with the Add/Remove Liq + Swap buttons is sticky

  if (error) return <Error message={error?.message} errorOnly />;

  return (
    <Page>
      <ContentWrapper>
        <StyledTitle title={title} parent={{ title: "Liquidity", path: "/wells" }} fontWeight="550" center />

        {/*
         *Header
         */}
        <HeaderContainer>
          <LoadingItem loading={loading} onLoading={<SkeletonHeader />}>
            <Item>
              <Header>
                <TokenLogos>{logos}</TokenLogos>
                <TextNudge amount={10} mobileAmount={-2}>
                  {title}
                </TextNudge>
                <div className="silo-yield-section">
                  <WellYieldWithTooltip
                    well={well}
                    tooltipProps={{
                      offsetX: isMobile ? -35 : 0,
                      offsetY: 0,
                      side: "top"
                    }}
                  />
                </div>
              </Header>
            </Item>
            <StyledItem column stretch>
              <FunctionName>{wellFunctionName}</FunctionName>
              <Fee>0.00% Trading Fee</Fee>
            </StyledItem>
          </LoadingItem>
        </HeaderContainer>

        {/*
         * Reserves
         */}
        <ReservesContainer>
          <LoadingItem loading={loading} onLoading={<SkeletonReserves />}>
            <Reserves reserves={reserves} well={well} twaReserves={twaReserves} />
          </LoadingItem>
        </ReservesContainer>

        {/*
         * Chart Section
         */}
        <ChartSectionContainer>
          <ChartSection well={well} loading={loading} />
        </ChartSectionContainer>

        {/*
         * Chart Type Button Selectors
         */}
        <ActivityOtherButtons gap={24} mobileGap={"0px"}>
          <LoadingItem loading={loading} onLoading={<SkeletonButtonsRow />}>
            <Item stretch>
              <TabButton onClick={(e) => showTab(e, 0)} active={tab === 0} stretch justify bold hover>
                Activity
              </TabButton>
            </Item>
            <Item stretch>
              <TabButton onClick={(e) => showTab(e, 1)} active={tab === 1} stretch justify bold hover>
                Contract Addresses
              </TabButton>
            </Item>
          </LoadingItem>
        </ActivityOtherButtons>

        {/*
         * Well History & Contract Info Tables
         */}
        <BottomContainer>
          {tab === 0 && <WellHistory well={well} tokenPrices={prices} reservesUSD={totalUSD} loading={loading} />}
          {tab === 1 && <OtherSection well={well} loading={loading} />}
        </BottomContainer>

        {/*
         * UI Helpers
         */}
        <ColumnBreak />
        <StickyDetector ref={containerRef} />

        {/*
         * Liquidity Swap Buttons
         * We render both Mobile & Desktop to prevent flex order switching animations from happening on page width changes
         */}
        <LiquiditySwapButtonsMobile sticky={isSticky}>
          <LoadingItem loading={loading} onLoading={<SkeletonButtonsRow />}>
            <Item stretch>
              <Button secondary label="Add/Rm Liquidity" onClick={goLiquidity} />
            </Item>
            <Item stretch>
              <Button label="Swap" onClick={goSwap} />
            </Item>
          </LoadingItem>
        </LiquiditySwapButtonsMobile>
        <LiquiditySwapButtonsDesktop gap={24}>
          <LoadingItem loading={loading} onLoading={<SkeletonButtonsRow />}>
            <Item stretch>
              <Button secondary label="Add/Rm Liquidity" onClick={goLiquidity} />
            </Item>
            <Item stretch>
              <Button label="Swap" onClick={goSwap} />
            </Item>
          </LoadingItem>
        </LiquiditySwapButtonsDesktop>

        {/*
         * Liquidity Box
         */}
        <LiquidityBoxContainer>
          <LiquidityBox well={well} loading={loading} />
        </LiquidityBoxContainer>

        {/*
         * Learn More
         */}
        <LearnMoreContainer>
          <LearnMoreLabel onClick={toggle}>
            <LearnMoreLine />
            <LearnMoreText>
              <TextNudge amount={2}>Learn more about this Well</TextNudge>
              <ImageButton
                component={ChevronDown}
                size={10}
                rotate={open ? "180" : "0"}
                onClick={toggle}
                padding="0px"
                alt="Click to expand and learn how to earn yield"
                color={"#46B955"}
              />
            </LearnMoreText>
            <LearnMoreLine />
          </LearnMoreLabel>
          <LearnMoreButtons open={open}>
            <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
              <LearnYield />
            </LoadingItem>
            <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
              <LearnWellFunction name={wellFunctionName || "A Well Function"} />
            </LoadingItem>
            <LoadingItem loading={loading} onLoading={<EmptyLearnItem />}>
              <LearnPump />
            </LoadingItem>
          </LearnMoreButtons>
        </LearnMoreContainer>
      </ContentWrapper>
    </Page>
  );
};

const leftColumnWidth = 940;
const rightColumnWidth = 400;

const calcWellContentMaxWidth = `min(calc(100% - 48px - 400px), ${leftColumnWidth}px)`;

const ContentWrapper = styled.div`
  display: flex;
  flex-flow: column wrap;
  flex: auto;
  justify-content: flex-start;
  align-content: start;
  gap: 24px;
  width: 100%;

  ${mediaQuery.lg.only} {
    height: 1600px;
  }

  ${mediaQuery.between.smAndLg} {
    max-width: ${size.mobile};
    flex: 2;
    align-self: center;
  }
`;

const StyledTitle = styled(Title)`
  order: -1;
`;

const Header = styled.div`
  display: flex;
  font-weight: 600;
  font-size: 32px;
  line-height: 32px;
  gap: 24px;

  ${mediaQuery.lg.down} {
    font-size: 24px;
    gap: 8px;
  }

  .silo-yield-section {
    align-self: center;
  }
`;

const TokenLogos = styled.div`
  display: flex;
  div:not(:first-child) {
    margin-left: -8px;
  }
`;

const HeaderContainer = styled(Row)`
  ${mediaQuery.lg.only} {
    display: flex;
    max-width: ${calcWellContentMaxWidth};
    width: 100%;
  }

  ${mediaQuery.lg.down} {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    order: 0;
  }

  ${mediaQuery.md.up} {
    align-item: space-between;
  }
`;

const ReservesContainer = styled.div`
  width: 100%;
  order: 3;

  ${mediaQuery.lg.only} {
    max-width: ${calcWellContentMaxWidth};
    width: 100%;
    order: 0;
  }
`;

const ChartSectionContainer = styled.div`
  width: 100%;
  order: 4;

  ${mediaQuery.lg.only} {
    display: block;
    max-width: ${calcWellContentMaxWidth};
    order: 0;
  }
`;

const ActivityOtherButtons = styled(Row)`
  width: 100%;
  order: 5;

  ${mediaQuery.lg.only} {
    max-width: ${calcWellContentMaxWidth};
    width: 100%;
    order: 0;
  }
`;

const StickyDetector = styled.div`
  width: 100%;
  position: sticky;
  height: 1px;
  background-color: transparent;
  margin-bottom: -24px;
  order: 2;

  ${mediaQuery.sm.up} {
    display: none;
  }
`;

const LiquiditySwapButtonsMobile = styled(Row)<{ sticky?: boolean }>`
  width: 100%;
  order: 2;
  top: 0px;
  z-index: 10;
  transition: all 0.3s ease-in-out;
  gap: 8px;

  ${mediaQuery.md.only} {
    max-width: ${size.mobile};
  }

  ${mediaQuery.sm.only} {
    position: sticky;
    gap: ${(props) => (props.sticky ? "0px" : "8px")};
    margin-left: ${(props) => (props.sticky ? "-12px" : "0px")};
    width: ${(props) => (props.sticky ? "100vw" : "100%")};
  }

  ${mediaQuery.lg.only} {
    display: none;
  }
`;

const LiquiditySwapButtonsDesktop = styled(Row)`
  max-width: ${rightColumnWidth}px;
  width: 100%;
  order: 0;
  margin-top: 48px;
  position: relative;
  margin-left: 0px;
  transition: all 0.3s ease-in-out;
  top: 0px;
  z-index: 10;

  ${mediaQuery.lg.down} {
    display: none;
  }
`;

const StyledItem = styled(Item)`
  align-items: flex-start;

  ${mediaQuery.lg.only} {
    align-items: flex-end;
  }
`;

const BottomContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  order: 6;

  ${mediaQuery.lg.only} {
    max-width: ${calcWellContentMaxWidth};
    width: 100%;
    order: 0;
  }
`;

const FunctionName = styled.div`
  ${BodyL}

  ${mediaQuery.lg.down} {
    ${BodyS}
  }
`;
const Fee = styled.div`
  ${BodyS}
  color: #4B5563;
  ${mediaQuery.lg.down} {
    ${BodyXS}
  }
`;

const LiquidityBoxContainer = styled.div`
  display: none;

  ${mediaQuery.lg.only} {
    display: block;
    max-width: ${rightColumnWidth}px;
  }
`;

const LearnMoreContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  order: 1;
  width: 100%;

  ${mediaQuery.lg.only} {
    max-width: ${rightColumnWidth}px;
    order: 0;
    gap: 24px;
  }
`;
const LearnMoreLabel = styled.div`
  display: flex;
  flex-direction: row;
  ${mediaQuery.lg.only} {
    display: none;
  }
`;

const LearnMoreLine = styled.div`
  align-self: center;
  flex-grow: 1;
  border-top: 1px solid #9ca3af;
  flex-basis: 1fr;
`;

const LearnMoreText = styled.div`
  display: flex;
  flex-direction: row;
  gap: 8px;
  align-items: center;
  width: 195px;
  color: #46b955;
  padding-right: 8px;
  padding-left: 8px;
  ${BodyXS}
  font-weight: 600;
`;

const LearnMoreButtons = styled.div<{ open: boolean }>`
  ${(props) => (props.open ? "display: flex" : "display: none")};
  flex-direction: column;
  gap: 16px;

  ${mediaQuery.lg.only} {
    display: flex;
    gap: 24px;
  }
`;

const ColumnBreak = styled.div`
  display: none;

  ${mediaQuery.lg.only} {
    display: block;
    flex-basis: 100%;
    width: 0px;
  }
`;

const EmptyLearnItem = styled.div`
  width: 100%;
  height: 48px;
  border: 0.5px solid #9ca3af;
  background: #f9f8f6;
`;

const MobileOnlyTokenLogoContainer = styled.div`
  display: none;
  ${mediaQuery.sm.only} {
    display: flex;
    justify-content: center;
    flex-direction: column;
    margin-top: 6px;
  }
`;

const NonMobileTokenLogoContainer = styled.div`
  display: block;

  ${mediaQuery.sm.only} {
    display: none;
  }
`;

const SkeletonHeader: React.FC<{}> = () => (
  <>
    <Item>
      <Header>
        <MobileOnlyTokenLogoContainer>
          <LoadingTemplate.TokenLogo count={2} size={24} />
        </MobileOnlyTokenLogoContainer>
        <NonMobileTokenLogoContainer>
          <LoadingTemplate.TokenLogo count={2} size={48} />
        </NonMobileTokenLogoContainer>
        <LoadingTemplate.Item width={150} height={32} margin={{ top: 8 }} />
      </Header>
    </Item>
    <StyledItem column stretch>
      <LoadingTemplate.Item height={24} width={150} />
      <LoadingTemplate.Item height={20} width={100} margin={{ top: 4 }} />
    </StyledItem>
  </>
);

const SkeletonReserves: React.FC<{}> = () => {
  return (
    <Row gap={24}>
      {Array(2)
        .fill(null)
        .map((_, i) => (
          <LoadingTemplate key={`ReservesLoading-${i}`}>
            <LoadingTemplate.Flex gap={4}>
              <LoadingTemplate.Item width={75} height={20} />
              <LoadingTemplate.Flex gap={4} row alignItems="flex-end">
                <LoadingTemplate.Item width={100} height={24} />
                <LoadingTemplate.Item width={70} height={24} />
              </LoadingTemplate.Flex>
            </LoadingTemplate.Flex>
          </LoadingTemplate>
        ))}
    </Row>
  );
};

const SkeletonButtonsRow: React.FC<{}> = () => (
  <>
    <Item stretch>
      <LoadingTemplate.Button />
    </Item>
    <Item stretch>
      <LoadingTemplate.Button />
    </Item>
  </>
);
