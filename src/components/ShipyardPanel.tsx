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
    <section className="elite-terminal-screen">
      <header className="elite-terminal-header">
        <div>
          <span className="elite-terminal-kicker">Shipyard / Outfitting</span>
          <h3 className="elite-terminal-title">{ship.name}</h3>
          <p className="elite-terminal-copy">
            {(ship.manufacturer || "Independent Yard").toUpperCase()} / CARGO {Math.round(ship.cargoCapacityTons ?? ship.cargoCapacity)}T / BERTHS {ship.passengerCapacity}
          </p>
        </div>
        <div className="elite-terminal-actions">
          <div className="elite-terminal-credit-box">
            <span>Credit Buffer</span>
            <strong><Coins size={14} /> {playerCredits.toLocaleString()} cr</strong>
          </div>
        </div>
      </header>

      <div className="elite-terminal-grid elite-terminal-grid-4">
        <div className="elite-terminal-stat">
          <span>Installed Modules</span>
          <strong>{installedUpgrades}</strong>
        </div>
        <div className="elite-terminal-stat">
          <span>Warp Capacity</span>
          <strong>{ship.warpCapacity ? `${ship.maxWarpRange} LY` : "Offline"}</strong>
        </div>
        <div className="elite-terminal-stat">
          <span>Berthed Hulls</span>
          <strong>{dockedPortInventory.length}</strong>
        </div>
        <div className="elite-terminal-stat">
          <span>Fuel Capacity</span>
          <strong>{Math.round(ship.maxFuel).toLocaleString()} kg</strong>
        </div>
      </div>

      <div className="elite-terminal-section">
        <div className="elite-terminal-section-bar">
          <span><Rocket size={14} /> Berthed Hulls</span>
          <strong>{dockedPortInventory.length > 0 ? "Local Inventory" : "No Stored Hulls"}</strong>
        </div>
        {dockedPortInventory.length > 0 ? (
          <div className="elite-terminal-table-wrap">
            <table className="elite-terminal-table">
              <thead>
                <tr>
                  <th>Hull</th>
                  <th>Manufacturer</th>
                  <th className="is-number">Cargo</th>
                  <th className="is-number">Berths</th>
                  <th className="is-number">Fuel</th>
                  <th className="is-actions">Status</th>
                </tr>
              </thead>
              <tbody>
                {dockedPortInventory.map((entry) => (
                  <tr key={entry.id}>
                    <td className="is-strong">{entry.name}</td>
                    <td>{entry.ship.manufacturer || "Unknown"}</td>
                    <td className="is-number">{entry.ship.cargoCapacityTons ?? entry.ship.cargoCapacity} t</td>
                    <td className="is-number">{entry.ship.passengerCapacity}</td>
                    <td className="is-number">{Math.round(entry.ship.maxFuel).toLocaleString()} kg</td>
                    <td className="is-actions">
                      <button
                        type="button"
                        className={`elite-terminal-button${ship.id === entry.id ? " is-active" : ""}`}
                        disabled={ship.id === entry.id}
                        onClick={() => onActivateShip(entry.id)}
                      >
                        {ship.id === entry.id ? "Active Hull" : "Make Active"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="elite-terminal-note">No additional hulls are berthed at this port.</div>
        )}
      </div>

      <div className="elite-terminal-section">
        <div className="elite-terminal-section-bar">
          <span><Settings2 size={14} /> Hull Market</span>
          <strong>{shipyardCatalog.length} Listed Frames</strong>
        </div>
        <div className="elite-terminal-table-wrap">
          <table className="elite-terminal-table">
            <thead>
              <tr>
                <th>Frame</th>
                <th>Builder</th>
                <th>Description</th>
                <th className="is-number">Class</th>
                <th className="is-number">Cost</th>
                <th className="is-actions">Acquire</th>
              </tr>
            </thead>
            <tbody>
              {shipyardCatalog.map((entry) => (
                <tr key={entry.id}>
                  <td className="is-strong">{entry.name}</td>
                  <td>{entry.manufacturer}</td>
                  <td>{entry.description}</td>
                  <td className="is-number">{entry.class.toUpperCase()}</td>
                  <td className="is-number elite-value-amber">{entry.baseCost.toLocaleString()} cr</td>
                  <td className="is-actions">
                    <button
                      type="button"
                      className="elite-terminal-button"
                      disabled={playerCredits < entry.baseCost}
                      onClick={() => onBuyShip(entry.id)}
                    >
                      Buy Hull
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="elite-terminal-section">
        <div className="elite-terminal-section-bar">
          <span><Wrench size={14} /> Installed Modules</span>
          <strong>Upgrade Matrix</strong>
        </div>
        <div className="elite-terminal-table-wrap">
          <table className="elite-terminal-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Category</th>
                <th>Description</th>
                <th className="is-number">Cost</th>
                <th className="is-actions">State</th>
              </tr>
            </thead>
            <tbody>
              {UPGRADES.map((upgrade) => {
                const isUnlocked = unlockedUpgradeIds.includes(upgrade.id);
                const needsCredits = playerCredits < upgrade.cost;
                return (
                  <tr key={upgrade.id}>
                    <td className="is-strong">{upgrade.name}</td>
                    <td>{upgrade.category.toUpperCase()}</td>
                    <td>{upgrade.description}</td>
                    <td className={`is-number ${isUnlocked ? "elite-value-green" : "elite-value-amber"}`}>
                      {isUnlocked ? "Installed" : `${upgrade.cost.toLocaleString()} cr`}
                    </td>
                    <td className="is-actions">
                      {isUnlocked ? (
                        <span className="elite-terminal-state is-ok">Installed</span>
                      ) : (
                        <button
                          type="button"
                          className="elite-terminal-button"
                          disabled={needsCredits}
                          onClick={() => onUnlockUpgrade(upgrade.id)}
                        >
                          Install
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
