// Local Imports
import { MainPanel } from "@/app/layouts/MainLayout/Sidebar/MainPanel";
import { navigation } from "@/app/navigation";
import { SidebarPanel } from "./SidebarPanel";

// ----------------------------------------------------------------------

export function Sidebar() {
  return (
    <>
      <MainPanel nav={navigation} activeSegmentPath="/apps" />
      <SidebarPanel />
    </>
  );
}
