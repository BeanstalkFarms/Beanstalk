import React, { useMemo } from "react";
import styled from "styled-components";
import { BodyL, BodyS } from "../Typography";
import { TokenLogo } from "../TokenLogo";
import useSdk from "src/utils/sdk/useSdk";
import { Tooltip, TooltipProps } from "../Tooltip";
import { TokenValue } from "@beanstalk/sdk";

import StartSparkle from "src/assets/images/start-sparkle.svg";
import { useIsMobile } from "src/utils/ui/useIsMobile";
import { Well } from "@beanstalk/sdk/Wells";
import { useBeanstalkSiloAPYs } from "src/wells/useBeanstalkSiloAPYs";
import { mediaQuery } from "src/breakpoints";

type Props = {
  well: Well | undefined;
  apy?: TokenValue;
  loading?: boolean;
  tooltipProps?: Partial<Pick<TooltipProps, "offsetX" | "offsetY" | "side">>;
};

export const WellYieldWithTooltip: React.FC<Props> = ({ tooltipProps, well }) => {
  const sdk = useSdk();

  const bean = sdk.tokens.BEAN;
  const isMobile = useIsMobile();

  const { getSiloAPYWithWell } = useBeanstalkSiloAPYs();

  const apy = useMemo(() => {
    const data = getSiloAPYWithWell(well);

    if (!data) return undefined;
    return `${data.mul(100).toHuman("short")}%`;
  }, [well, getSiloAPYWithWell]);

  const tooltipWidth = isMobile ? 250 : 360;

  if (!apy) {
    return <>{"-"}</>;
  }

  return (
    <TooltipContainer>
      <Tooltip
        content={
          <Container>
            <TitleContainer>
              <div className="title">Well Yield</div>
              <div className="label-value">
                <div className="label">
                  <div className="logo-wrapper">
                    <TokenLogo token={bean} size={16} />
                  </div>
                  Bean vAPY
                </div>
                {apy}
              </div>
            </TitleContainer>
            <ContentContainer>
              <div>
                The Variable Bean APY (vAPY) uses historical data of Beans earned by{" "}
                <a
                  href="https://docs.bean.money/almanac/guides/silo/understand-silo-vapy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underlined"
                >
                  Silo Depositors
                </a>
                &nbsp;to estimate future returns.
              </div>
            </ContentContainer>
          </Container>
        }
        offsetY={tooltipProps?.offsetY || 0}
        offsetX={tooltipProps?.offsetX || 0}
        arrowOffset={0}
        arrowSize={0}
        side={tooltipProps?.side || "top"}
        bgColor="white"
        width={tooltipWidth}
      >
        <ChildContainer>
          <StyledImg src={StartSparkle} alt="basin-bean-vAPY" />
          <div>{apy} vAPY</div>
        </ChildContainer>
      </Tooltip>
    </TooltipContainer>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  padding: 4px;
  box-sizing: border-box;

  .underlined {
    text-decoration: underline;

    &:visited {
      color: #000;
    }
  }

  ${mediaQuery.sm.only} {
    gap: 16px;
  }
`;

const TitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  gap: 8px;

  .title {
    ${BodyS}
    font-weight: 600;
  }

  .label-value {
    display: flex;
    flex-direction: row;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    ${BodyS}
    color: #46b955;
    font-weight: 600;

    .logo-wrapper {
      position: relative;
      margin-top: 2px;
    }

    .label {
      display: flex;
      flex-direction: row;
      gap: 4px;
    }
  }
`;

const ContentContainer = styled.div`
  display: flex;
  width: 100%;
  ${BodyS}
  text-align: left;
`;

const StyledImg = styled.img`
  display: flex;
  width: 24px;
  height: 24px;
  padding: 3px 2px 3px 3px;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;

  ${mediaQuery.sm.only} {
    height: 20px;
    width: 20px;
  }
`;

const ChildContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  background: #edf8ee;
  padding: 4px;
  color: #46b955;
  width: max-content;
  border-radius: 4px;

  ${BodyL}
  font-weight: 600;

  ${mediaQuery.sm.only} {
    ${BodyS}
  }
`;

const TooltipContainer = styled.div`
  width: max-content;
`;
