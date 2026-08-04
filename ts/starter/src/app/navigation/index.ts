import { NavigationTree } from "@/@types/navigation";
import { ceoNavigation, systemNavigation } from "./ceoOs";

// Navegação "global" do template — usada pela busca (Search) e pelo MainLayout.
// Reflete os produtos CEO OS. A sidebar do Sideblock usa getNavigationForPath
// (por produto) e não depende deste array.
export const navigation: NavigationTree[] = [
  ...Object.values(ceoNavigation).flat(),
  ...systemNavigation,
];
