# Layer 11A: Raw Parashari Ashtakavarga Foundation

Layer 11A is a deterministic, provider-independent natal D1 Rashi calculation. It consumes the canonical Rashi facts for Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, and Ascendant. It performs no astronomy, ayanamsha, longitude, house, Varga, Dasha, transit, or interpretation calculation.

The selected ruleset is `parashari-rekha-bav-santhanam-v1`. A positive engine allocation is named `favorableMark`; its classical metadata is Rekha. In the selected Santhanam/BPHS terminology, Karan/Bindu is the adverse zero mark. Modern positive “bindu” usage is recorded only as a later convention and is not an engine field.

Layer 11A returns seven planetary raw Bhinnashtakavargas in the fixed order Sun through Saturn, each with eight fixed contributors: Sun through Saturn and Ascendant. It also returns a separate Lagna BAV. Rahu and Ketu neither contribute nor receive BAVs in this ruleset; unrelated node input is ignored.

Raw SAV uses only the seven planetary BAVs under `parashari-raw-sarvashtakavarga-v1`; it explicitly excludes Lagna BAV and retains per-target evidence. Its fixed grand total is 337. Raw BAV totals are Sun 48, Moon 49, Mars 39, Mercury 54, Jupiter 56, Venus 52, Saturn 39, and separately Lagna 47.

All outputs and canonical reference data are deeply immutable. Layer 11B is deliberately deferred: Trikona Shodhana, Ekadhipatya Shodhana, Rashi/Graha/Shodhya Pinda, Kakshya, transit composition, and all interpretation remain out of scope.
