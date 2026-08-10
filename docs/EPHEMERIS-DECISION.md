# Ephemeris Decision

## Decision

The target production provider is **Swiss Ephemeris** under Astrodienst's **Swiss Ephemeris Professional License**. It is the preferred provider because it directly supports sidereal calculations and Lahiri modes, supplies lunar-node calculations, and is a well-established astrology-grade ephemeris. The provider remains behind the `EphemerisProvider` interface.

## Commercial licensing implication

Swiss Ephemeris is dual-licensed. The public distribution is AGPL; shipping it in a proprietary mobile application or using it in a proprietary calculation service without satisfying AGPL obligations is not acceptable for KundlInsights. The Professional License is the commercial path: its contract expressly covers both distributed apps and server-based calculations. Procurement must purchase and sign that license before a release containing Swiss Ephemeris code or data is distributed.

This repository must not add the AGPL Swiss Ephemeris package as an unreviewed production dependency. The future `SwissEphemerisProvider` implementation is therefore a controlled integration task, gated on recording the executed license and the exact Swiss Ephemeris/data release in the dependency inventory. Until that gate is completed, the repository contains only a provider-interface boundary. The future implementation must use native `SE_SIDM_LAHIRI`, an extended-ayanamsha API equivalent, recorded returned calculation flags, Mean Rahu with exactly opposite Ketu, geocentric planetary coordinates, and an observer-aware Ascendant. Experimental POC values are not production golden references.

Sources: [Swiss Ephemeris overview](https://www.astro.com/swisseph/sweph_e.htm), [Professional License contract](https://forum.astro.com/swisseph/secont_e.pdf), and [programming documentation](https://www.astro.com/ftp/swisseph/doc/swephprg.2.10.htm).

## Interim provider

Layer 1 uses the MIT-licensed [Astronomy Engine](https://github.com/cosinekitty/astronomy) behind the same interface. It permits commercial distribution and has JavaScript, C, and Kotlin/JVM implementations, but it is not a Jyotish-specific ephemeris: Lahiri conversion and mean-node handling are performed in the KundlInsights adapter. Its stated typical positional accuracy is ±1 arcminute, so it is acceptable only for contract development, deterministic testing, and internal pre-production use. It is not approved as the final calculation provider for KundlInsights releases where chart-boundary accuracy is material.

## Alternatives considered

| Option | Commercial fit | Trade-off |
| --- | --- | --- |
| Swiss Ephemeris Professional | Yes, after contract | Best domain fit; paid license and vendor/data governance. |
| Swiss Ephemeris AGPL | No for planned proprietary distribution | Would impose AGPL source-distribution obligations. |
| Astronomy Engine (MIT) | Yes | Easy to ship, but lower stated accuracy and no native Lahiri/node contract. |
| JPL Horizons API | No as primary mobile foundation | Network-dependent, not an offline deterministic embedded provider, and unsuitable as the sole production calculation layer. |

## Release gate

Before production release, replace the interim provider with `SwissEphemerisProvider`, pin its source/data versions, add cross-provider reference fixtures, complete legal review, and record the executed Professional License in the private compliance system.
