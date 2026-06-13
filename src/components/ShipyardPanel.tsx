import React from "react";
import { Coins, Rocket, Settings2, Wrench } from "lucide-react";
import { OwnedShipRecord, ShipState } from "../types";
import { UPGRADES } from "../utils/gameData";
import { ShipyardCatalogEntry } from "../utils/shipManagement";

interface ShipyardPanelProps {
  ship: ShipState;
  playerCredits: number;
  unlockedUpgradeIds: string[];
  onUnlockUpgrade: (upgradeId: string) => void;
  onBuyShip: (modelId: string) => void;
  onActivateShip: (shipId: string) => void;
  shipyardCatalog: ShipyardCatalogEntry[];
  dockedPortInventory: OwnedShipRecord[];
}

export const ShipyardPanel: React.FC<ShipyardPanelProps> = ({
  ship,
  playerCredits,
  unlockedUpgradeIds,
  onUnlockUpgrade,
  onBuyShip,
  onActivateShip,
  shipyardCatalog,
  dockedPortInventory,
}) => {
  const installedUpgrades = UPGRADES.filter((upgrade) => unlockedUpgradeIds.includes(upgrade.id)).length;

  return (
    <div className="space-y-5 font-sans">
      <div className="elite-station-panel-shell">
        <div className="elite-station-panel-header">
          <div>
            <h3 className="elite-station-panel-title">
              <Wrench className="w-4 h-4" /> Shipyard and Outfitting
            </h3>
            <p className="elite-station-panel-subtitle">Berth management, hull acquisition, and installed module work.</p>
          </div>
          <div className="elite-station-panel-credit">
            <span>Credit Buffer</span>
            <strong><Coins className="w-4 h-4" /> {playerCredits.toLocaleString()} cr</strong>
          </div>
        </div>

        <div className="elite-shipyard-overview">
          <div>
            <span>Active Hull</span>
            <strong>{ship.name}</strong>
            <small>{ship.manufacturer || "Independent Yard"} • cargo {(ship.cargoCapacityTons ?? ship.cargoCapacity).toFixed(0)}t</small>
          </div>
          <div>
            <span>Installed Upgrades</span>
            <strong>{installedUpgrades}</strong>
            <small>{ship.warpCapacity ? `Warp ${ship.maxWarpRange} LY` : "No interstellar drive"}</small>
          </div>
          <div>
            <span>Berthed Hulls</span>
            <strong>{dockedPortInventory.length}</strong>
            <small>Only local hulls can be made active here.</small>
          </div>
        </div>
      </div>

      <div className="elite-station-section">
        <div className="elite-station-section-heading">
          <Rocket className="w-4 h-4" />
          <span>Berthed Hulls</span>
        </div>
        <div className="elite-shipyard-grid">
          {dockedPortInventory.length > 0 ? dockedPortInventory.map((entry) => (
            <div key={entry.id} className="elite-shipyard-card">
              <div>
                <strong>{entry.name}</strong>
                <small>{entry.ship.manufacturer} • cargo {entry.ship.cargoCapacityTons ?? entry.ship.cargoCapacity}t • berths {entry.ship.passengerCapacity}</small>
              </div>
              <button
                type="button"
                disabled={ship.id === entry.id}
                onClick={() => onActivateShip(entry.id)}
                className={ship.id === entry.id ? "is-disabled" : ""}
              >
                {ship.id === entry.id ? "Active Hull" : "Make Active"}
              </button>
            </div>
          )) : (
            <div className="elite-shipyard-empty">No additional hulls are berthed at this port.</div>
          )}
        </div>
      </div>

      <div className="elite-station-section">
        <div className="elite-station-section-heading">
          <Settings2 className="w-4 h-4" />
          <span>Hull Market</span>
        </div>
        <div className="elite-shipyard-grid">
          {shipyardCatalog.map((entry) => (
            <div key={entry.id} className="elite-shipyard-card">
              <div>
                <strong>{entry.name}</strong>
                <small>{entry.manufacturer} • {entry.class.toUpperCase()}</small>
                <p>{entry.description}</p>
              </div>
              <div className="elite-shipyard-actions">
                <span>{entry.baseCost.toLocaleString()} cr</span>
                <button
                  type="button"
                  disabled={playerCredits < entry.baseCost}
                  onClick={() => onBuyShip(entry.id)}
                  className={playerCredits < entry.baseCost ? "is-disabled" : ""}
                >
                  Buy Hull
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="elite-station-section">
        <div className="elite-station-section-heading">
          <Wrench className="w-4 h-4" />
          <span>Installed Modules</span>
        </div>
        <div className="elite-upgrade-grid">
          {UPGRADES.map((upgrade) => {
            const isUnlocked = unlockedUpgradeIds.includes(upgrade.id);
            const needsCredits = playerCredits < upgrade.cost;
            return (
              <div key={upgrade.id} className={`elite-upgrade-card${isUnlocked ? " is-installed" : ""}`}>
                <div>
                  <span>{upgrade.category.toUpperCase()}</span>
                  <strong>{upgrade.name}</strong>
                  <p>{upgrade.description}</p>
                </div>
                <div className="elite-shipyard-actions">
                  {isUnlocked ? (
                    <span>Installed</span>
                  ) : (
                    <>
                      <span>{upgrade.cost.toLocaleString()} cr</span>
                      <button
                        type="button"
                        disabled={needsCredits}
                        onClick={() => onUnlockUpgrade(upgrade.id)}
                        className={needsCredits ? "is-disabled" : ""}
                      >
                        Install
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
