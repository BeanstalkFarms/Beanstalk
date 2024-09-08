import React from "react";

import { Route, Routes } from "react-router-dom";

import { Frame } from "src/components/Frame/Frame";
import { NotFound } from "src/pages/404";
import { Build } from "src/pages/Build";
import { Create } from "src/pages/Create";
import { Dev } from "src/pages/Dev";
import { Home } from "src/pages/Home";
import { Liquidity } from "src/pages/Liquidity";
import { Swap } from "src/pages/Swap";
import { Well } from "src/pages/Well";
import { Wells } from "src/pages/Wells";
import { Settings } from "src/settings";

export const App = ({}) => {
  const isNotProd = !Settings.PRODUCTION;

  return (
    <Frame>
      <Routes>
        <Route index element={<Home />} />
        <Route path="/wells" element={<Wells />} />
        <Route path="/wells/:address" element={<Well />} />
        <Route path="/wells/:address/liquidity" element={<Liquidity />} />
        <Route path="/swap" element={<Swap />} />
        <Route path="/build" element={<Build />} />
        <Route path="/create" element={<Create />} />
        {isNotProd && <Route path="/dev" element={<Dev />} />}
        <Route path="*" element={<NotFound />} />
        {false && <></>}
      </Routes>
    </Frame>
  );
};
