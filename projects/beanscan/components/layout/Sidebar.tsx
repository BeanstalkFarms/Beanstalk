import Link from "next/link";
import dynamic from 'next/dynamic'

const Connect = dynamic(() => import("./Connect"), {
  ssr: false,
});

const Sidebar : React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="overflow-hidden">
      <Link href="/">
        <img src="https://bean.money/logo.svg" alt="Beanstalk" className="h-8" />
      </Link>
      <hr />
      <Connect />
    </div>
  )
};

export default Sidebar;