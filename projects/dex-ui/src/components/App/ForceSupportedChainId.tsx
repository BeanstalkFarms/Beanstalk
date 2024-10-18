import React, { useEffect, useState } from "react";

import { ConnectKitButton, useModal } from "connectkit";
import { useLocation, useNavigate } from "react-router-dom";
import styled from "styled-components";

import { ChainId, ChainResolver } from "@beanstalk/sdk-core";

import { ChainIdError, useChainErr, useSetChainErr } from "src/state/atoms/chain.atoms";
import { useSdkChainId } from "src/utils/chain";
import { theme } from "src/utils/ui/theme";

import { ButtonPrimary } from "../Button";
import { Logo } from "../Icons";
import { Flex } from "../Layout";
import { Modal } from "../Modal";
import { LinksNav, Text } from "../Typography";

const UNSUPPORTED_CHAIN_ID = -1;

/**
 *
 * @returns
 * - Returns -1 if unsupported chainId (e.g., Not ETH or Arbitrum)
 * - Returns chainId if supported
 */
function parseChainIdFromPath(location: ReturnType<typeof useLocation>) {
  const segments = location.pathname.split("/");
  const first = segments?.[1];

  if (first?.toLowerCase() !== "wells") return;

  const chainId = segments?.[2];

  try {
    const cidNum = parseInt(chainId);
    if (Object.values(ChainId).includes(cidNum)) {
      return cidNum;
    }
  } catch (_e: any) {
    // do nothing;
  }

  return UNSUPPORTED_CHAIN_ID;
}

function getNavigateUrl(
  toChainId: ChainId,
  location: ReturnType<typeof useLocation>,
  stay: boolean
) {
  const segments = location.pathname.split("/");
  const first = segments?.[1];

  if (first?.toLowerCase() === "wells") {
    const address = segments?.[3];
    const addressPortion = address && stay ? `/${address}` : "";
    return `/wells/${toChainId}${addressPortion}`;
  }
  return `/`;
}

const CHAIN_ID_TO_NAME = {
  [ChainId.ETH_MAINNET]: "Ethereum Mainnet",
  [ChainId.ARBITRUM_MAINNET]: "Arbitrum Mainnet"
};

export const ForceSupportedChainId = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const setChainErr = useSetChainErr();
  const [navLink, setNavLink] = useState<string | null>(null);

  const urlChainId = parseChainIdFromPath(location);
  const chainId = useSdkChainId();
  const chainIdErr = useChainErr();

  const { openSwitchNetworks, setOpen } = useModal();

  const handleStayOnCurrentNetwork = () => {
    navigate(getNavigateUrl(chainId, location, false));
  };

  const handleSetSwitchNetworkUrl = () => {
    if (urlChainId) {
      setNavLink(getNavigateUrl(urlChainId, location, true));
    }
  };

  useEffect(() => {
    if (chainId !== urlChainId) return;
    if (navLink) {
      const url = navLink;
      setOpen(false);
      setNavLink(null);
      navigate(url);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, urlChainId, navLink]);

  useEffect(() => {
    if (urlChainId) {
      if (urlChainId === UNSUPPORTED_CHAIN_ID) {
        setChainErr(ChainIdError.INVALID);
        return;
      } else if (
        ChainId[urlChainId] &&
        ChainResolver.resolveToMainnetChainId(urlChainId) !==
          ChainResolver.resolveToMainnetChainId(chainId)
      ) {
        setChainErr(ChainIdError.INCORRECT);
        return;
      }
    }

    if (!!chainIdErr) {
      setChainErr(null);
    }
  }, [chainIdErr, location, urlChainId, chainId, setChainErr]);

  return (
    <>
      <Modal allowClose={!chainIdErr} open={!!chainIdErr} onOpenChange={() => {}}>
        <Modal.Content noTitle>
          <ModalContentWrapper $fullWidth $alignItems="center">
            <Flex $gap={2}>
              <Flex $direction="row" $gap={0.5} $alignItems="center">
                <Logo width={24} height={24} />
                <Brand>BASIN</Brand>
              </Flex>
              <Flex $direction="column" $gap={1}>
                {chainIdErr === ChainIdError.INVALID ? (
                  <>
                    <Text $align="left">This network is not supported</Text>
                    <Text $align="left" $variant="xs" $color="text.secondary">
                      Basin is currently only available on Ethereum and Arbitrum Mainnet.
                    </Text>
                  </>
                ) : null}
                {chainIdErr === ChainIdError.INCORRECT && urlChainId ? (
                  <>
                    <Text $align="left">Looks like you&apos;re connected to the wrong network</Text>
                    <Text $align="left" $variant="xs" $color="text.secondary">
                      Switch to{" "}
                      {CHAIN_ID_TO_NAME[ChainResolver.resolveToMainnetChainId(urlChainId)]} or stay
                      on this network to continue.
                    </Text>
                  </>
                ) : null}
              </Flex>
              <Flex $gap={1}>
                <ConnectKitButton.Custom>
                  {() => {
                    return (
                      <ButtonPrimary
                        onClick={(e) => {
                          e.preventDefault();
                          openSwitchNetworks();
                          handleSetSwitchNetworkUrl();
                        }}
                      >
                        Switch Network
                      </ButtonPrimary>
                    );
                  }}
                </ConnectKitButton.Custom>
                {chainIdErr === ChainIdError.INCORRECT ? (
                  <ButtonPrimary $variant="outlined" onClick={handleStayOnCurrentNetwork}>
                    Stay on {CHAIN_ID_TO_NAME[ChainResolver.resolveToMainnetChainId(chainId)]}
                  </ButtonPrimary>
                ) : null}
              </Flex>
            </Flex>
          </ModalContentWrapper>
        </Modal.Content>
      </Modal>
    </>
  );
};

const ModalContentWrapper = styled(Flex)`
  max-width: 290px;
  min-width: 290px;
  width: 100%;

  ${theme.media.query.sm.only} {
    min-width: min(calc(100vw - 96px), 400px);
    max-width: min(calc(100vw - 96px), 400px);
    width: 100%;
  }
`;

const Brand = styled.div`
  text-transform: uppercase;
  ${LinksNav};
  margin-bottom: -6px;
`;
