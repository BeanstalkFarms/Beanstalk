import RootProviders from 'app/providers'
import Layout from 'components/Layout'
import '../styles/globals.css'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="[color-scheme:dark]">
      <head />
      <body className="text-gray-200">
        <RootProviders>
          <Layout>
            {children}
          </Layout>
        </RootProviders>
      </body>
    </html>
  )
}
