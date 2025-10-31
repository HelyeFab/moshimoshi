// Force dynamic rendering for homepage with i18n
export const dynamic = 'force-dynamic'

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
