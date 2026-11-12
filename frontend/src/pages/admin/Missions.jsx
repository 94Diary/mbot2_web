import { MissionListPage } from '../../features/missions/MissionListPage.jsx';

export function AdminMissions() {
  return (
    <MissionListPage endpoint="/admin/missions" title="ภารกิจและข้อมูล" sub="ภารกิจที่บันทึกของทุกคน · เปิดดูหรือลบได้" showOwner
      linkTo={(m) => `/console/missions/${m.id}`} />
  );
}
