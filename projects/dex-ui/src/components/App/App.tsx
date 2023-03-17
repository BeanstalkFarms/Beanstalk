import React from "react";
import { Route, Routes } from "react-router-dom";
import { NotFound } from "src/pages/404";
import { Home } from "src/pages/Home";
import { Swap } from "src/pages/Swap";
import { Wells } from "src/pages/Wells";
import { Frame } from "../Frame/Frame";

export const App = () => {
  return (
    <Frame>
      <Routes>
        <Route index element={<Home />} />
        <Route path="/swap" element={<Swap />} />
        <Route path="/wells" element={<Wells />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Frame>
  );
};
