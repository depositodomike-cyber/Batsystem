// Import Dependencies
import { Outlet } from "react-router";

// Local Imports
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AssistenteHost } from "@/components/template/Assistente";

// ----------------------------------------------------------------------

export default function Sideblock() {
  return (
    <>
      <Header />
      <main className="main-content transition-content grid grid-cols-1">
        <Outlet />
      </main>
      <Sidebar />
      <AssistenteHost />
    </>
  );
}
