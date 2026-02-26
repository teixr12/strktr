import { PortalClientView } from '@/components/portal/portal-client-view'

export const dynamic = 'force-dynamic'

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PortalClientView token={token} />
}
