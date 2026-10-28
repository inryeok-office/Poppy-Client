import { MissionDetailView } from '@/views/missions';

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ missionId: string }>;
}) {
  const { missionId } = await params;
  return <MissionDetailView missionId={missionId} />;
}
