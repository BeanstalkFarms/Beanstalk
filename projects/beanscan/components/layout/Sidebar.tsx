"use client";

import Link from "next/link";
import dynamic from 'next/dynamic'
import {ChevronRightIcon} from '@heroicons/react/24/solid';
import { IRoutes, ROUTES } from './routes';
import React, { useState } from "react";
import { useSelectedLayoutSegment, usePathname } from "next/navigation";
import clsx from "clsx";

import styles from './Sidebar.module.scss';
import NavButton from "components/Layout/NavButton";

const ROUTE_KEYS = Object.keys(ROUTES);

const Connect = dynamic(() => import("./Connect"), {
  ssr: false,
});
const NavItem : React.FC<{ 
  id: keyof IRoutes;
  selectedLayoutSegment: string | null;
  pathname: string | null;
}> = ({ id, selectedLayoutSegment, pathname }) => {
  const item = ROUTES[id];
  const [expanded, setExpanded] = useState(selectedLayoutSegment === item.segment);
  return (
    <div>
      <NavButton
        top
        name={id as string}
        icon={item.icon}
        onClick={() => setExpanded(!expanded)}
        expanded={expanded}
        hasNested={item.nested.length > 1}
      />
      {(item.nested.length > 1 && expanded) ? (
        item.nested.map((route) => (
          <NavButton
            active={pathname === route.path}
            key={route.name}
            path={route.path}
            name={route.name}
            icon={undefined}
            top={false}
          />
        ))
      ) : null}
    </div>
  )
};

const Sidebar : React.FC<React.PropsWithChildren> = ({ children }) => {
  const s = useSelectedLayoutSegment();
  const p = usePathname();
  return (
    <div className="overflow-x-hidden px-3 py-3 space-y-4">
      <div className="px-1">
        <Link href="/" className="flex flex-row items-center space-x-2">
          <img src={'/assets/bean-logo-circled.svg'} className="w-8" />
          <h1 className="text-2xl font-bold text-gray-200">Beanscan</h1>
        </Link>
      </div>
      <div>
        <h3 className={styles.sidebar_header}>Dashboards</h3>
        {ROUTE_KEYS.map((key) => (
          <NavItem
            key={key}
            id={key}
            selectedLayoutSegment={s}
            pathname={p}
          /> 
        ))}
      </div>
      <Connect />
    </div>
  )
};

export default Sidebar;