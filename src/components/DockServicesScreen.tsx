import React from "react";
import { Anchor, Briefcase, Coins, Fuel, HardDrive, Settings, ShoppingCart, Wrench } from "lucide-react";
import { PortRecord } from "../utils/worldText";

type DockServiceTab = "dock-main" | "market" | "upgrades" | "contracts";

interface DockServicesScreenProps {
  port: PortRecord;
  credits: number;
  cargoFreeTons: number;
  surveyDataValue: number;
  activeContracts: number;
  canRefuel: boolean;
  hasShipyardAccess: boolean;
  onOpenTab: (tab: Exclude<DockServiceTab, "dock-main">) => void;
  onUndock: () => void;
}

const serviceCards: Array<{
  id: Exclude<DockServiceTab, "dock-main">;
  label: string;
  description: string;
  icon: React.ElementType;
  serviceGate?: string;
}> = [
  {
    id: "market",
    label: "Market Exchange",
    description: "Trade cargo, refuel tanks, and move survey packets through station commerce.",
    icon: ShoppingCart,
    serviceGate: "markets",
  },
  {
    id: "upgrades",
    label: "Shipyard and Outfitting",
    description: "Review hull capability, install upgrades, and switch berthed ships when available.",
    icon: Settings,
  },
  {
    id: "contracts",
    label: "Mission Board",
    description: "Check dispatch traffic, sign contracts, and turn in completed runs.",
    icon: Briefcase,
    serviceGate: "contracts",
  },
];

export const DockServicesScreen: React.FC<DockServicesScreenProps> = ({
  port,
  credits,
  cargoFreeTons,
  surveyDataValue,
  activeContracts,
  canRefuel,
  hasShipyardAccess,
  onOpenTab,
  onUndock,
}) => {
  const serviceStatus = [
    { label: "Credit Buffer", value: `${credits.toLocaleString()} cr`, icon: Coins },
    { label: "Cargo Free", value: `${cargoFreeTons.toFixed(1)} t`, icon: HardDrive },
    { label: "Survey Queue", value: `${surveyDataValue.toLocaleString()} cr`, icon: ShoppingCart },
    { label: "Active Runs", value: `${activeContracts}`, icon: Briefcase },
  ];

  return (
    <section className="elite-dock-services">
      <header className="elite-dock-services-hero">
        <div>
          <div className="elite-dock-services-kicker">Station Services</div>
          <h2>{port.name}</h2>
          <p>{port.faction} traffic grid online. Select a terminal and continue operations from the dock network.</p>
        </div>
        <div className="elite-dock-services-meta">
          <div>
            <span>Port Type</span>
            <strong>{port.kind === "station" ? "Orbital Station" : "Planetary Port"}</strong>
          </div>
          <div>
            <span>Primary Body</span>
            <strong>{port.bodyName}</strong>
          </div>
          <div>
            <span>Live Services</span>
            <strong>{port.services.join(" / ").toUpperCase()}</strong>
          </div>
        </div>
      </header>

      <div className="elite-dock-status-grid">
        {serviceStatus.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="elite-dock-status-card">
              <span><Icon size={14} /> {item.label}</span>
              <strong>{item.value}</strong>
            </div>
          );
        })}
      </div>

      <div className="elite-dock-ops-strip">
        <div className={`elite-dock-ops-chip${canRefuel ? "" : " is-muted"}`}>
          <Fuel size={14} />
          {canRefuel ? "Fuel transfer available" : "Fuel transfer waiting on stock or funds"}
        </div>
        <div className={`elite-dock-ops-chip${hasShipyardAccess ? "" : " is-muted"}`}>
          <Wrench size={14} />
          {hasShipyardAccess ? "Shipyard network unlocked" : "No shipyard services at this berth"}
        </div>
      </div>

      <div className="elite-dock-services-grid">
        {serviceCards.map((card) => {
          const Icon = card.icon;
          const available = !card.serviceGate || port.services.includes(card.serviceGate);
          return (
            <button
              key={card.id}
              type="button"
              className={`elite-dock-service-card${available ? "" : " is-disabled"}`}
              onClick={() => available && onOpenTab(card.id)}
              disabled={!available}
              title={available ? card.label : "This service is not provisioned at the current port"}
            >
              <span className="elite-dock-service-icon">
                <Icon size={18} />
              </span>
              <span className="elite-dock-service-copy">
                <strong>{card.label}</strong>
                <small>{card.description}</small>
              </span>
            </button>
          );
        })}
      </div>

      <footer className="elite-dock-services-footer">
        <div className="elite-dock-service-status">
          <Wrench size={15} />
          Dock clamps locked. External work crews have station access to the hull.
        </div>
        <button type="button" className="elite-dock-undock" onClick={onUndock}>
          <Anchor size={15} />
          Release Clamps
        </button>
      </footer>
    </section>
  );
};
