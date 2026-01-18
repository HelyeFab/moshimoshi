import { ReactNode } from 'react'
import PageContainer from '@/components/ui/PageContainer'

export default async function GrammarLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  await params

  return (
    <PageContainer gradient="default" showPattern={true}>
      {children}
    </PageContainer>
  )
}
