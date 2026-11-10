import { redirect } from 'next/navigation';

import { isMissionsEnabled } from '@/features/mission';
import { MissionListView } from '@/views/missions';

export default function MissionsPage() {
  if (!isMissionsEnabled()) redirect('/');
  return <MissionListView />;
}
