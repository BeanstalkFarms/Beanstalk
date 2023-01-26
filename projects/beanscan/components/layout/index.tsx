import Sidebar from "components/Layout/Sidebar";

const Layout : React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className="flex flex-row">
      <div className="w-64">
        <Sidebar />
      </div>
      <div className="flex-1 p-3">
        {children}
      </div>
    </div>
  )
};

export default Layout;