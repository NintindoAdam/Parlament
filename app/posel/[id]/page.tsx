import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MemberProfile } from '@/components/MemberProfile'
import { asset } from '@/lib/asset'
import { getAllMPs, getClubMeta, getMP, getWiki } from '@/lib/data'

export function generateStaticParams() {
  return getAllMPs().map((mp) => ({ id: String(mp.id) }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const mp = getMP(Number(id))
  if (!mp) return { title: 'Nie znaleziono posła' }
  const club = getClubMeta(mp.club)
  return {
    title: mp.name,
    description: `${mp.name} — ${club.name}${mp.districtName ? `, okręg ${mp.districtName}` : ''}. Profil posła X kadencji Sejmu RP.`,
    openGraph: {
      title: `${mp.name} — ${club.name}`,
      description: `Profil posła X kadencji Sejmu RP.`,
      images: mp.hasPhoto ? [{ url: asset(`/photos/${mp.id}.jpg`) }] : undefined,
    },
  }
}

export default async function PoselPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const mp = getMP(Number(id))
  if (!mp) notFound()

  const club = getClubMeta(mp.club)
  const wiki = await getWiki(mp.id)

  return <MemberProfile mp={mp} club={club} wiki={wiki} />
}
