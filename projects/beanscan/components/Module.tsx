const Module : React.FC<{ children: React.ReactNode; title: string; className?:string }> = ({ children, title, className }) => {
  return (
    <div className={`border border-gray-400 ${className} rounded-lg overflow-hidden`}>
      <h2 className="border-b border-gray-400 bg-gray-700 px-2 py-1 font-bold">{title}</h2>
      {children}
    </div>
  )
}
export default Module;