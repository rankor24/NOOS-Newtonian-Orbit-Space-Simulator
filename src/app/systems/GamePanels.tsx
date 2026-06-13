import { Suspense, lazy } from "react";
import { CelestialBody, GameState, OwnedShipRecord } from "../../types";
import { CommanderProfileSummary } from "../../utils/saveSystem";
import { ShipyardCatalogEntry } from "../../utils/shipManagement";

const MarketPanel = lazy(() => import("../../components/MarketPanel").then((m) => ({ default: m.MarketPanel })));
const ShipyardPanel = lazy(() => import("../../components/ShipyardPanel").then((m) => ({ default: m.ShipyardPanel })));
const ContractsPanel = lazy(() => import("../../components/ContractsPanel").then((m) => ({ default: m.ContractsPanel })));

const LazyPanelFallback = () => (
  <div className="elite-terminal-screen">
    <div className="elite-terminal-note">Loading station terminal...</div>
  </div>
);

interface GamePanelsProps {
  activeTab: "market" | "upgrades" | "contracts";
  gameState: GameState;
  profileSummaries: CommanderProfileSummary[];
  systemBodies: CelestialBody[];
  shipyardCatalog: ShipyardCatalogEntry[];
  dockedPortInventory: OwnedShipRecord[];
  onSelectProfile: (profileId: string) => void;
  onSaveProfile: () => void;
  onCreateProfile: () => void;
  onDeleteProfile: () => void;
  onBuy: (resourceId: string, amount: number) => void;
  onSell: (resourceId: string, amount: number) => void;
  onDock: () => void;
  onUndock: () => void;
  onRefuel: () => void;
  onSellSurveyData: () => void;
  onToggleMining: () => void;
  onSelectPort: (portId: string) => void;
  onBuyShip: (modelId: string) => void;
  onActivateShip: (shipId: string) => void;
  onUnlockUpgrade: (upgradeId: string) => void;
  onAcceptContract: (id: string) => void;
  onCompleteContract: (id: string) => void;
  onResumeTutorial: () => void;
}

export function GamePanels({
  activeTab,
  gameState,
  systemBodies,
  shipyardCatalog,
  dockedPortInventory,
  onBuy,
  onSell,
  onDock,
  onUndock,
  onRefuel,
  onSellSurveyData,
  onToggleMining,
  onSelectPort,
  onBuyShip,
  onActivateShip,
  onUnlockUpgrade,
  onAcceptContract,
  onCompleteContract,
  onResumeTutorial,
}: GamePanelsProps) {
  return (
    <Suspense fallback={<LazyPanelFallback />}>
      <>
        {activeTab === "market" && (
          <MarketPanel
            gameState={gameState}
            onBuy={onBuy}
            onSell={onSell}
            onDock={onDock}
            onUndock={onUndock}
            onRefuel={onRefuel}
            onSellSurveyData={onSellSurveyData}
            onToggleMining={onToggleMining}
            onSelectPort={onSelectPort}
            onBuyShip={onBuyShip}
            onActivateShip={onActivateShip}
            shipyardCatalog={shipyardCatalog}
            dockedPortInventory={dockedPortInventory}
            bodies={systemBodies}
          />
        )}
        {activeTab === "upgrades" && (
          <ShipyardPanel
            ship={gameState.ship}
            playerCredits={gameState.playerCredits}
            unlockedUpgradeIds={gameState.unlockedUpgradeIds}
            onUnlockUpgrade={onUnlockUpgrade}
            onBuyShip={onBuyShip}
            onActivateShip={onActivateShip}
            shipyardCatalog={shipyardCatalog}
            dockedPortInventory={dockedPortInventory}
          />
        )}
        {activeTab === "contracts" && (
          <ContractsPanel
            gameState={gameState}
            bodies={systemBodies}
            onAcceptContract={onAcceptContract}
            onCompleteContract={onCompleteContract}
            onResumeTutorial={onResumeTutorial}
          />
        )}
      </>
    </Suspense>
  );
}
