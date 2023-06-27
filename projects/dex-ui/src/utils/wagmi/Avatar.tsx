import React from "react";
import { Types } from "connectkit";
import Jazzicon, { jsNumberForAddress } from "react-jazzicon";

export const Avatar = ({ address, size }: Types.CustomAvatarProps) => {
  return <Jazzicon diameter={size} seed={jsNumberForAddress(address!)} />;
};
