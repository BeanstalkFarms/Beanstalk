"use client";

import Link from "next/link";
import {ChevronRightIcon} from '@heroicons/react/24/solid';
import clsx from "clsx";

import styles from './NavButton.module.scss';

const NavButton : React.FC<{
  path?: string;
  href?: string;
  active?: boolean;
  onClick?: any;
  icon?: React.ReactNode;
  name: string;
  top?: boolean;
  expanded?: boolean;
  hasNested?: boolean;
}> = ({ path, href,  active, icon, name, top, expanded, hasNested, onClick }) => {
  const button = (
    <button
      className={clsx(styles.button, active && styles.active, top && styles.top)}
      onClick={onClick}
    >
      <span></span>
      <div className="flex-1">{name}</div>
      {hasNested ?
        <ChevronRightIcon height={12} className={`${expanded ? 'rotate-90' : ''}`} /> 
        : null}
    </button>
  )

  if (path) {
    return (
      <Link href={path}>
        {button}
      </Link>
    );
  }

  return button;
}

export default NavButton;