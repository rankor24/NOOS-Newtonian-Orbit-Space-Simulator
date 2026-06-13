import { Suspense, lazy } from "react";
import { CelestialBody, GameState, OwnedShipRecord } from "../../types";
import { CommanderProfileSummary } from "../../utils/saveSystem";
import { ShipyardCatalogEntry } from "../../utils/shipManagement";

const MarketPanel = lazy(() => import("../../components/MarketPanel").then((m) => ({ default: m.MarketPanel })));
const ShipyardPanel = lazy(() => import("../../components/ShipyardPanel").then((m) => ({ default: m.ShipyardPanel })));
const ContractsPanel = lazy(() => import("../../components/ContractsPanel").then((m) => ({ default: m.ContractsPanel })));
const CommanderPanel = lazy(() => import("../../components/CommanderPanel").then((m) => ({ default: m.CommanderPanel })));
const ProfilePanel = lazy(() => import("../../components/ProfilePanel").then((m) => ({ default: m.ProfilePanel })));

const LazyPanelFallback = () => (
  <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-4 text-xs text-stone-500">Loading module...</div>
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
  profileSummaries,
  systemBodies,
  shipyardCatalog,
  dockedPortInventory,
  onSelectProfile,
  onSaveProfile,
  onCreateProfile,
  onDeleteProfile,
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
        <div className="space-y-4 mb-4">
          <ProfilePanel
            currentProfileId={gameState.profileId}
            profiles={profileSummaries}
            onSelectProfile={onSelectProfile}
            onSaveProfile={onSaveProfile}
            onCreateProfile={onCreateProfile}
            onDeleteProfile={onDeleteProfile}
          />
          <CommanderPanel commanderName={gameState.commanderName} profile={gameState.playerProfile} credits={gameState.playerCredits} />
        </div>
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
