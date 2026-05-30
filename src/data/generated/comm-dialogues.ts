/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Communication log dialogue templates for Newtonian Orbit Space Simulator.
 *
 * These are text templates for in-game comms log entries — station hails,
 * docking requests, scan sequences, protocol messages, and bandit chatter.
 * The mission log type in types.ts currently uses { timestamp, text, type },
 * so these serve as feed data that the game loop can pull from.
 */

// ─── Station Approach — Ship hails station ───────────────────────────────────

export const STATION_APPROACH_HAILS: string[] = [
  "inbound to station. Requesting approach vector.",
  "approach vector requested. Holding at beacon.",
  "on approach path. Transmitting ship ID and cargo manifest.",
  "entering station controlled space. Acknowledge.",
  "standard approach pattern established. Request docking guidance.",
  "on final approach. Ready for station handshake.",
  "closing distance. Traffic control, please confirm beacon lock.",
  "on visual range. Station floodlights identified. Transmitting call sign on channel 7.",
  "approach request sent. Maintaining station-keeping at 5 km. Ready for vector assignment.",
  "on final approach from the dayside. Orbital traffic seems light today. Request priority slot.",
  "station approach beacon acquired. Coming in retrograde for easy docking alignment.",
  "hailing station control. Ship registry attached. Do you need us on cargo lock manual or automated?",
  "entering traffic corridor. Please confirm we are clear for approach path charlie-three.",
];

// ─── Station Scan Responses — Station scans incoming ship ───────────────────

export const STATION_SCAN_RESPONSES: string[] = [
  "Scanning vessel. Transponder confirmed. Cargo hold contents logged. No anomalies detected.",
  "You are being scanned. Frame integrity nominal. Power signature within expected parameters.",
  "Station scan complete. Vessel ID matched registry. Hull composition verified.",
  "Automated scan initiated. checking transponder. checking heat signature. checking mass reading.",
  "Deep scan in progress. Do not alter power distribution during scan window.",
  "Scan shows no weapons hardpoints active. No outstanding fines. Proceed.",
  "Scan complete. Transponder signal matches system registry. Cargo: no contraband detected.",
  "Life signs confirmed. Crew count logged. Medic alert: no quarantine flags on this vessel.",
  "Thermal scan shows engine signature matches filed flight plan. You are cleared for approach.",
  "Running parallel scan now. Cross-referencing hull ID with pirate watchlist. Negative match.",
  "Mass reading is within expected range for this ship class. No hidden compartments detected.",
];

// ─── Docking Approval ────────────────────────────────────────────────────────

export const DOCKING_APPROVED: string[] = [
  "Docking request approved. Assigned to pad 7-delta. Follow guide lights at 50 m/s.",
  "Approved for docking. Bay access opening. Collision grid active. Watch your starboard thruster.",
  "Docking clearance granted. Pad 12-alpha. Station gravity field active inside the bay.",
  "Welcome to station. Docking pad 3-bravo. Atmosphere mix: standard terrestrial. No suit required.",
  "Approved. Bay 5. Deactivate weapons before threshold crossing. Repeat: deactivate weapons.",
  "Pad 9-gamma is yours. Station clock reads 14:32 ship-local. No loiter. No unscheduled departures.",
  "Docking approved. Your hull fits pad 22. Clear for manual or autodock — your call.",
  "Approved for bay 4. Station interior gravity is 0.8 G. Mind the transition on entry.",
  "Clearance granted. Your assigned bay has direct access to the market concourse. Good for business.",
  "You are cleared for docking. Magnetic grapples will engage on contact. Do not apply reverse thrust once latched.",
  "Approved. Pad 19. Bring her in nose-first. The bay is pressurised and ready.",
  "Docking authorised. Priority berth assigned due to your fleet standing. Thank you for your service, commander.",
  "Approved. Bay 12 is reserved for vessels carrying hazardous materials. Your manifest qualifies.",
];

// ─── Docking Denied ──────────────────────────────────────────────────────────

export const DOCKING_DENIED: string[] = [
  "Docking denied. Your transponder shows outstanding fines in this jurisdiction. Settle at the kiosk or leave orbit.",
  "Negative on docking. Station at capacity. Try the outer ring facility or wait in holding orbit.",
  "Docking denied. Do not approach. You are flagged for cargo inspection. Stand by for customs launch.",
  "Access refused. Ship ID not in trusted registry. Contact station administration on channel 4.",
  "Denied. Pad reserved for priority traffic. Your queue position: 4. ETA for next slot: 12 minutes.",
  "Docking denied. Weapons system detected as active. Power them down and re-request.",
  "Cannot approve. Proximity alert — debris field on approach vector. Hold position until clearance.",
  "Docking denied. Your registry shows an active bounty in this system. Station security has been notified.",
  "Refused. Bay maintenance in progress. Find a different station or wait for the 30-minute service window.",
  "Denied. You are not on the authorised docking list. Contact the station administrator to request access.",
  "Access denied. Ship mass exceeds pad weight limit for all current bays. Try the outer ring external docks.",
  "Docking denied. Your vessel is flagged for mandatory hull inspection. Proceed to the inspection beacon at mark 4-alpha.",
  "Negative. Atmospheric containment cycle active in all bays. No docking possible for another 45 minutes.",
];

// ─── Protocol Messages — Station informs ship of rules ──────────────────────

export const STATION_PROTOCOLS: string[] = [
  "By entering this station's controlled space you accept local jurisdiction and scan authority.",
  "No weapons fire within 5 km of station hull. Violators will be engaged by defence grid.",
  "Speed limit in docking lane: 100 m/s. Collision penalties apply per USD Space Traffic Code.",
  "Fuel transfer only at designated points. Unauthorised fuel siphoning is a class-2 offence.",
  "Dumping cargo in station space is prohibited. Environmental hazard fines start at 10,000 credits.",
  "Data relays are monitored. Unauthorised network taps will result in permanent docking ban.",
  "No salvage operations within station debris zone. Salvage vessels must clear before retrieval.",
  "Unmanned drones are not permitted in docking corridors. All vessels must maintain active pilot control.",
  "All outgoing ships must file a flight plan before undocking. This station logs departure vectors for system control.",
  "Transponder must remain active at all times within 10 km of station hull. Tampering is a class-1 felony.",
  "Emergency exits are marked on your approach schematic. Memorise their locations. Review bay evacuation protocol.",
  "Customs inspection may be conducted on any vessel at any time. Failure to comply results in impoundment.",
  "Noise pollution in the docking bay is subject to local ordinances. Keep engine tests to scheduled windows.",
];

// ─── Ship Following Protocol — Ship confirms station instructions ─────────────

export const SHIP_ACKNOWLEDGMENTS: string[] = [
  "Copy that. Throttle back to approach speed. Ready on your mark.",
  "Acknowledged. Systems set to station-frequency standard. Proceeding.",
  "Roger. Cargo manifest transmitted. Hailing channel switching to approach band now.",
  "Received. Adjusting vector to match beacon lock. Standing by for final clearance.",
  "Confirmed. Holding at checkpoint. Guide lights acquired. Moving in.",
  "Understood. Station authority logged. Power distribution set to standby for docking.",
  "Roger that. Adjusting throttle to approach speed. Ready for bay assignment.",
  "Copy. Transponder set to station channel. incoming nav beam acquired.",
  "Acknowledged. Collision avoidance active. Guide lights in sight. Proceeding.",
  "Read you loud and clear. Attitude correction in progress. Aligning with bay orientation.",
  "Confirmed. Switching to station internal comms. Docking gear deploying.",
];

// ─── Departure Messages — Ship leaving station ───────────────────────────────

export const DEPARTURE_MESSAGES: string[] = [
  "Departure approved. Clear of bay in 30 seconds. Safe flight, captain.",
  "Bay pressurising. Doors opening. Watch for cross-traffic on departure vector.",
  "Clear to depart. Station traffic controller hands you over to system control. Fly safe.",
  "Departure corridor is green. No incoming traffic on your vector. Good hunting out there.",
  "Thank you for docking. Credits deducted for pad fee (standard rate). See you next time.",
  "Bay is open. Leaving station space. Next time bring better cargo — this station buys He3 at premium.",
  "Departure approved. Tranquil travel, commander. Report any anomalies to system control.",
  "Undocking in 10 seconds. Confirm all mooring lines retracted. External hatches sealed.",
  "You are clear to depart. Leaving the bay now. Mind your drift — there is a tug to port.",
  "Pad release granted. Please signal when you are 2 km clear so we can allocate your bay.",
  "Departure corridor assigned. Traffic advisory: a Belt Tanker Co-op vessel is approaching on reciprocal heading.",
];

// ─── Refueler Hails — Tanker ships hailing player ────────────────────────────

export const REFUELER_HAILS: string[] = [
  "Tanker rig ready. Fuel cells at 100%. Price per kg on display. Transfer rate: 500 kg/s.",
  "Refueling station active. We got standard hydrogen and premium He3. Cash or cargo trade only.",
  "Heads up — I show your fuel mass at 12% and falling. You want a top-up before you're on ballistic trajectory?",
  "Docking collar extended. Connect at the forward port. Slow approach — my rig has a cold bridge.",
  "Scoop tube deployed. Match velocity and I'll feed you. Don't come in hot or we both burn.",
  "Refuel depot here. If you got water ice I can trade it for processed fuel. 2:1 exchange.",
  "Fuel transfer authorised. Our pump rate is 800 kg per minute. Keep your engines in standby mode.",
  "This is Golden Tanker one-niner. We have 40,000 kg of hydrogen and 12,000 kg of He3. Come alongside.",
  "Tanker drifting on this marker. Low on pilot hours, high on fuel. Best prices this side of Neptune.",
  "Small craft refueling station at these coordinates. We cater to explorers and survey vessels. Precision fills only.",
  "Refueling buoy echo-seven is active. Pre-pay via station credits or cargo. Receipt auto-filed with your registry.",
];

// ─── Bandit/Pirate Hails ─────────────────────────────────────────────────────

export const BANDIT_HAILS: string[] = [
  "Unidentified ship, you have entered a restricted claim zone. Cut engines and prepare for inspection.",
  "This is a hold-up. Drop 8 tons of cargo and I let you keep flying. Refuse and I'll vacuum your hull.",
  "You see my hardpoints? They are not for show. Cargo or canopy. Your pick.",
  "Nice ship you got there. Real nice. Shame if something happened to its drive cone.",
  "I'm not asking. I am telling. Jettison cargo now or I open fire.",
  "Captain, my sensors show you have a full hold and light shields. That is a dangerous combination.",
  "I don't want your ship. I want what's in it. You have 10 seconds to eject your cargo manifest.",
  "You're a long way from help. No patrols out here. No witnesses either. You understand what I'm saying?",
  "Your transponder says you're a trader. My transponder says I don't care. Pay the belt tax.",
  "That's far enough. One more meter and I scramble your nav computer. He3 or hull.",
  "Attention, cargo vessel. You just entered dead space. No patrols. No witnesses. Cargo, now.",
  "I have been shadowing you since the Titan beacon. You never saw me. That is the problem.",
  "Interdiction in progress. Match my vector or I open fire. I have nothing to lose out here.",
  "Your shields can hold maybe twelve seconds against my loadout. Let us not waste time.",
  "Drop your cargo and boost away. I don't care who you are or where you are going. The belt feeds.",
  "You are flying a coffin with delusions of flight capability. Prove me wrong or dump cargo.",
  "This is a lawful claim under Belt Salvage Code 7-bravo. Your ship is salvage if you refuse.",
  "I have a manifest interceptor on your data link. I know exactly what you are carrying. Don't lie.",
  "Your heat signature is beautiful. A nice thermal bloom right where the cargo hold sits.",
];

// ─── Bandit Threat Escalation — When player ignores or fights ────────────────

export const BANDIT_THREATS: string[] = [
  "Last warning! Cut throttle now or I put a round through your power plant!",
  "You had your chance. Missiles armed. Say goodbye to your cargo hatch.",
  "Fine. Salvage it is. Your ship will look beautiful in my hold.",
  "You think you can outrun me in that frame? I built my career chasing faster ships than yours.",
  "Shields up. Weapons hot. I gave you an exit — now you get a coffin.",
  "Your choice. I was hoping you'd fight. Makes the salvage more interesting.",
  "You are going to regret that. My wing is already en route. You cannot outrun a coordinated intercept.",
  "Shields at 80%. You hit like a station approach drone. I have been hit harder by solar wind.",
  "That was your one warning shot. Next salvo goes straight through your canopy. Last chance.",
  "I will burn your cargo, not your hull, if you power down now. One more shot and that offer expires.",
  "You are fast, I will give you that. But my missiles are faster. Interceptor rounds armed.",
];

// ─── Station Distress Signals / Emergency Broadcasts ─────────────────────────

export const EMERGENCY_BROADCASTS: string[] = [
  "MAYDAY MAYDAY — Station Core Overflow — reactor temperature critical. All ships clear to 20 km.",
  "Distress call relayed from unregistered vessel at these coordinates. No transponder response.",
  "Medical emergency on deck 4. Station requesting any vessel with medical supplies to dock immediately.",
  "Fuel leak detected on approach corridor. Avoid area 7-alpha. Containment crew en route.",
  "Security breach on cargo deck sector C. Lockdown in progress. All docked ships — remain sealed.",
  "Debris alert — micrometeorite field inbound. Stations sealing external vents. Ships retract sensors.",
  "MAYDAY — Uncontrolled decompression on deck 12. All non-crew clear the sector. Engineering team responding.",
  "Attention all vessels. Faction dispute in progress at the outer beacon. Keep clear or be engaged.",
  "Biohazard alert on cargo section. Quarantine initiated. Do not open any external hatches until cleared.",
  "System-wide test of emergency broadcast network. This is a drill. All stations acknowledge receipt.",
  "Distress beacon from automated cargo hauler. Cargo: refined metals. Salvage rights available through station admin.",
];

// ─── Faction / Guild Automated Messages ──────────────────────────────────────

export const FACTION_AUTOMATED_MESSAGES: string[] = [
  "[USD TRAFFIC CONTROL] Standard traffic pattern in effect throughout Sol. Report unusual activity to local authority.",
  "[Belt Miners Syndicate] Ore prices adjusted per market index. Current payout at Ceres: 240 cr/ton.",
  "[Mars Colonial Authority] Atmospheric processing cycle active. No low-altitude flights over Olympus basin.",
  "[Jovian Economic Zone] Gas giant scooping permits required for all vessels entering orbital refuel zones.",
  "[Saturnine Hydrocarbon Board] Ice sat extraction moratorium lifted. Titan depots accepting full loads.",
  "[Kuiper Frontier Collective] Unauthorised deep-space salvage is prohibited beyond 50 AU. This is your only warning.",
  "[USD INSPECTORATE] All vessels carrying He3 must file end-user declaration before docking at core stations.",
  "[Soyuz Orbital Group] Crew ferry schedule update. Next departure: Station Mir-2 to Baikonur-2 at 14:30 station time.",
  "[Nakamura Drive Works] Drive efficiency notice. Firmware update available for Nakamura ion cascade units. Dock at Tsukuba for patch.",
  "[Hayabusa Heavy Industries] Prospector recall. All Hayabusa-class vessels report status to nearest Hayabusa depot for safety inspection.",
  "[Terran Unity Fleet Command] Expeditionary fleet announcement. All fleets hold position pending navigation update. Stand by.",
  "[Liberty Dynamics] Landing window advisory. Solar flare activity expected. Liberty landers clear surface operations until further.",
  "[Gromov Design Bureau] Engine recall notice. RD-180 units manufactured between 2088-2091 may have injector fatigue. Inspect at Vostok Station.",
];

// ─── Player Docking Status Messages (for the in-game log) ────────────────────

export const PLAYER_ACTION_MESSAGES: string[] = [
  "Docking sequence complete. Ship secured. Station gravity engaged.",
  "Undocking complete. Leaving bay. Thrusters green. Local traffic pattern active.",
  "Autodock engaged. Ship computer taking control. Relax and keep hands off the stick.",
  "Manual docking. Final approach speed nominal. Landing gear deployed.",
  "Docking aborted. Collision warning from bay sensor array. Pulling up.",
  "Bay pressurisation cycle started. Waiting for atmospheric equalization.",
  "Docking bay assigned. Approach corridor clear. Engaging station-local frame of reference.",
  "Undocking granted. Systems transitioning from station power to ship power. Internal battery charging.",
  "Landing gear retracted. Bay doors opening. Ensure cargo is secured for zero-g departure.",
  "Docking clamp released. RCS thrusters active. Drifting clear of station structure.",
  "Grapple disengaged. Backing away from pad. Station traffic controller confirms clear path.",
  "Autodock disengaged. Manual control restored. Welcome to the station. Mind the speed limit inside the bay.",
];

// Helper functions below this line - leave untouched.

/**
 * Helper: pick a random item from any of these arrays.
 */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Combine a station hail + scan + verdict into a single log entry template.
 * Handy for writing a complete dock approach sequence into the log array.
 */
export function generateDockingSequence(): { hail: string; scan: string; verdict: string; ack: string } {
  return {
    hail: pickRandom(STATION_APPROACH_HAILS),
    scan: pickRandom(STATION_SCAN_RESPONSES),
    verdict: pickRandom([...DOCKING_APPROVED, ...DOCKING_DENIED]),
    ack: pickRandom(SHIP_ACKNOWLEDGMENTS),
  };
}
