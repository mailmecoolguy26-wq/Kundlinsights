'use strict';

const Astronomy = require('astronomy-engine');
const { EphemerisProvider } = require('./ephemeris-provider');
const { normalizeLongitude } = require('./sidereal-calculator');

const BODY_MAP = Object.freeze({ Sun: Astronomy.Body.Sun, Moon: Astronomy.Body.Moon, Mars: Astronomy.Body.Mars, Mercury: Astronomy.Body.Mercury, Jupiter: Astronomy.Body.Jupiter, Venus: Astronomy.Body.Venus, Saturn: Astronomy.Body.Saturn });
const DAY_MS = 86400000;

function signedLongitudeDelta(from, to) { return ((to - from + 540) % 360) - 180; }

function ecliptic(body, instant) {
  if (body === 'Moon') {
    const moon = Astronomy.EclipticGeoMoon(instant);
    return { longitude: moon.lon, latitude: moon.lat, distance: moon.dist };
  }
  const value = Astronomy.Ecliptic(Astronomy.GeoVector(BODY_MAP[body], instant, true));
  return { longitude: value.elon, latitude: value.elat, distance: value.vec.Length() };
}

function bodyResult(body, instant) {
  const value = ecliptic(body, instant);
  const previous = ecliptic(body, new Date(instant.getTime() - 0.01 * DAY_MS));
  const next = ecliptic(body, new Date(instant.getTime() + 0.01 * DAY_MS));
  const speed = signedLongitudeDelta(previous.longitude, next.longitude) / 0.02;
  return { body, tropicalLongitudeDegrees: normalizeLongitude(value.longitude), latitudeDegrees: value.latitude, distanceAu: value.distance, longitudeSpeedDegreesPerDay: speed, motion: Math.abs(speed) < 1e-7 ? 'stationary' : speed < 0 ? 'retrograde' : 'direct', coordinateSystem: 'apparent-geocentric-true-ecliptic-of-date' };
}

function meanNodeTropicalLongitude(instant) {
  const jd = instant.getTime() / DAY_MS + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  return normalizeLongitude(125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000);
}

class AstronomyEngineProvider extends EphemerisProvider {
  constructor() { super(); this.metadata = Object.freeze({ provider: 'Astronomy Engine', providerVersion: '2.1.17', ephemerisVersion: 'Astronomy Engine VSOP87/NOVAS model (temporary)', calculationMode: 'interim-development-reference', rawCoordinateSystem: 'apparent-geocentric-true-ecliptic-of-date', calculationStatus: 'PROVISIONAL' }); }
  calculate(instant) {
    const bodies = Object.fromEntries(Object.keys(BODY_MAP).map((body) => [body, bodyResult(body, instant)]));
    const rahuLongitude = meanNodeTropicalLongitude(instant);
    const nodeSpeed = (meanNodeTropicalLongitude(new Date(instant.getTime() + 0.01 * DAY_MS)) - meanNodeTropicalLongitude(new Date(instant.getTime() - 0.01 * DAY_MS))) / 0.02;
    bodies.Rahu = { body: 'Rahu', tropicalLongitudeDegrees: rahuLongitude, latitudeDegrees: 0, distanceAu: null, longitudeSpeedDegreesPerDay: nodeSpeed, motion: 'retrograde', coordinateSystem: 'mean-ascending-lunar-node; tropical-ecliptic-of-date' };
    bodies.Ketu = { body: 'Ketu', tropicalLongitudeDegrees: normalizeLongitude(rahuLongitude + 180), latitudeDegrees: -0, distanceAu: null, longitudeSpeedDegreesPerDay: nodeSpeed, motion: 'retrograde', coordinateSystem: 'derived-descending-lunar-node; tropical-ecliptic-of-date; exactly-opposite-rahu' };
    return { bodies, provider: this.metadata };
  }
}

module.exports = { AstronomyEngineProvider, normalizeLongitude };
