# Layer 10: Transit Event Scanner

Layer 10 scans UTC intervals through the existing Layer 1 engine and compares Layer 9 Gochar snapshots. It does not calculate astronomy, ayanamsha, interpretation, prediction, or event outcomes. Scan steps are capped at one hour; bracketed transitions are refined by bisection to one second with 32 iterations maximum. Event timestamps denote the refined first instant the new state is active. A stationary provider window is coalesced into one directional station event; it records its entry and later directional confirmation. Equal-time events use the approved stable event-type order.

Implementation is checkpointed internally as Layer 10A, the provider-neutral transition-refinement, validation, ordering, deduplication, provenance, and station-window core, followed by Layer 10B, the full event-family coverage. This is an implementation split only; the public architecture remains Layer 10.
