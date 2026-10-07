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
import { isFeatureTemporarilyDisabled } from "@/app/data/temporarilyDisabledFeatures";
import { Group } from "./Group";
import { AiStudioGroup } from "./AiStudioGroup";
import { SquadsGroup } from "./SquadsGroup";
import { AgrupamentosGroup } from "./AgrupamentosGroup";
import { CreateProjectModal } from "./CreateProjectModal";
import { ContextSection } from "./ContextSection";

// Produtos que exibem o grupo "Agrupamentos" na sidebar. O histórico de
// conversas vive na aba Histórico do painel do assistente (bolinha).
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
  const contextNav = navigation
    .flatMap((group) => group.childs ?? [])
    .find((item) => item.id.endsWith(".memoria-grafo"));
  const showContextSections = productCode === "behuman" && !!contextNav;

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
    <>
      {/*
        `absolute!`: o CSS do SimpleBar (`[data-simplebar] { position: relative }`)
        vence o `absolute` do Tailwind, e sem o limite de altura a lista
        transbordava por baixo do rodapé da sidebar (Pasta local) em vez de rolar.
        `overflow-hidden`: o `.simplebar-wrapper` interno segue com a altura do
        conteúdo e, sem o recorte, cobriria o rodapé e engoliria os cliques.
      */}
      <SimpleBar
        scrollableNodeProps={{ ref }}
        className="absolute! inset-0 overflow-hidden"
      >
        <Accordion
          value={expanded}
          onChange={setExpanded}
          className="space-y-1 pb-6"
        >
          {showContextSections && <ContextSection product={productCode} />}
          {navigation.map((nav) => (
            <Group key={nav.id} data={nav} />
          ))}
          {showSquads && <AiStudioGroup product={productCode} />}
          {showSquads && !isFeatureTemporarilyDisabled("sidebarAgents") && (
            <SquadsGroup />
          )}
          {showGroupings && <AgrupamentosGroup product={productCode} />}
        </Accordion>
      </SimpleBar>

      {showGroupings && (
        <CreateProjectModal
          isOpen={isCreateOpen}
          close={closeCreate}
          product={productCode}
        />
      )}
    </>
  );
}
