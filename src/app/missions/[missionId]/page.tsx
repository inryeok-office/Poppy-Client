import { redirect } from 'next/navigation';

import { isMissionsEnabled } from '@/features/mission';
import { MissionDetailView } from '@/views/missions';

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  if (!isMissionsEnabled()) redirect('/');
  const { missionId } = await params;
  return <MissionDetailView missionId={missionId} />;
}
