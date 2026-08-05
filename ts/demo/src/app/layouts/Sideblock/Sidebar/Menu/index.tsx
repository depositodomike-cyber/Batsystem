// Import Dependencies
import { useLocation } from "react-router";
import { useLayoutEffect, useRef, useState } from "react";
import SimpleBar from "simplebar-react";

// Local Imports
import { useDidUpdate } from "@/hooks";
import {
  getNavigationForPath,
  getProductCodeFromPath,
  SQUADS_PRODUCT_CODE,
} from "@/app/navigation/ceoOs";
import { useProjectsContext } from "@/app/contexts/projects/context";
import { Accordion } from "@/components/ui";
import { isRouteActive } from "@/utils/isRouteActive";
import { Group } from "./Group";
import { AiStudioGroup } from "./AiStudioGroup";
import { SquadsGroup } from "./SquadsGroup";
import { AgrupamentosGroup } from "./AgrupamentosGroup";
import { HistoricoGroup } from "./HistoricoGroup";
import { CreateProjectModal } from "./CreateProjectModal";

// Produtos que exibem os grupos "Agrupamentos" e "Histórico" na sidebar.
const PRODUCTS_WITH_GROUPINGS = ["behuman"];

// ----------------------------------------------------------------------

export function Menu() {
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement | null>(null);
  const { isCreateOpen, closeCreate } = useProjectsContext();

  const navigation = getNavigationForPath(pathname);
  const productCode = getProductCodeFromPath(pathname);
  const showGroupings = PRODUCTS_WITH_GROUPINGS.includes(productCode);
  const showSquads = productCode === SQUADS_PRODUCT_CODE;

  const activeGroup = navigation.find((item) => {
    if (item.path) return isRouteActive(item.path, pathname);
  });

  const activeCollapsible = activeGroup?.childs?.find((item) => {
    if (item.path) return isRouteActive(item.path, pathname);
  });

  const [expanded, setExpanded] = useState<string | null>(
    activeCollapsible?.path || null,
  );

  useDidUpdate(() => {
    if (activeCollapsible?.path !== expanded)
      setExpanded(activeCollapsible?.path || null);
  }, [activeCollapsible?.path]);

  useLayoutEffect(() => {
    const activeItem = ref.current?.querySelector("[data-menu-active=true]");
    activeItem?.scrollIntoView({ block: "center" });
  }, [pathname]);

  return (
    <SimpleBar
      scrollableNodeProps={{ ref }}
      className="min-h-0 flex-1 overflow-x-hidden pb-6"
    >
      <Accordion value={expanded} onChange={setExpanded} className="space-y-1">
        {navigation.map((nav) => (
          <Group key={nav.id} data={nav} />
        ))}
        {showSquads && <AiStudioGroup product={productCode} />}
        {showSquads && <SquadsGroup />}
        {showGroupings && <AgrupamentosGroup product={productCode} />}
        {showGroupings && <HistoricoGroup product={productCode} />}
      </Accordion>

      {showGroupings && (
        <CreateProjectModal
          isOpen={isCreateOpen}
          close={closeCreate}
          product={productCode}
        />
      )}
    </SimpleBar>
  );
}
