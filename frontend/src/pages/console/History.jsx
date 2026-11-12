import { MissionListPage } from '../../features/missions/MissionListPage.jsx';

export function History() {
  return <MissionListPage endpoint="/missions" title="ประวัติของฉัน" sub="ภารกิจที่บันทึกไว้ เรียงตามวัน" />;
}

