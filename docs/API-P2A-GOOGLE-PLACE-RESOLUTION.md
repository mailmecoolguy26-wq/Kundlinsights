# API-P2A Google Place Resolution

`GET /v1/places/search?q=<query>` and `POST /v1/places/resolve-birth-time` require the existing verified bearer principal. Google Maps Platform Geocoding API is used only server-side for place search and place-ID re-resolution. It is not a timezone authority.

## Production configuration

`GOOGLE_MAPS_API_KEY` is supplied by production secret injection, restricted to the required Google Maps Platform Geocoding API, and never sent to Flutter or logs. `GOOGLE_GEOCODING_TIMEOUT_MS` is optional and defaults to 5000 ms (bounded to 100–15000 ms). `TIMEZONE_RUNTIME_MANIFEST_PATH` and `TIMEZONE_RUNTIME_BINARY_PATH` name the separately deployed, verified TBB runtime artifacts. No Google request is made by `/ready`; valid configuration and normal runtime dependency checks are the API-P2A readiness boundary.

## Public contract

Search returns no more than five safe candidates:

```json
{
  "results": [{
    "id": "provider-place-id",
    "label": "Hyderabad, Telangana, India",
    "latitude": 17.385,
    "longitude": 78.4867,
    "timezone": "Asia/Kolkata",
    "timezoneProvenance": {}
  }]
}
```

Birth-time resolution accepts a selected `place.id` and `localDate` (`YYYY-MM-DD`) plus `localTime` (`HH:mm[:ss]`). Any client label, coordinates, or timezone are intentionally ignored. The server re-resolves the provider place ID, derives the IANA timezone from the external approved TBB 2026c runtime artifact, and passes that timezone with the local civil date/time to the backend chronology utility. The response is canonical `birthData` containing `localDate`, `localTime`, `timezone`, `utc`, server-derived coordinates, and `timezoneProvenance`. Flutter P4 must send that result unchanged to `POST /v1/birth-profiles`; it must not derive timezone or UTC.

`LOCAL_TIME_AMBIGUOUS` and `LOCAL_TIME_NONEXISTENT` fail closed. `LOCAL_TIME_INVALID`, `PLACE_QUERY_INVALID`, and `PLACE_NOT_FOUND` are client errors. `PLACE_PROVIDER_UNAVAILABLE`, `PLACE_RESOLUTION_FAILED`, and `TIMEZONE_RESOLUTION_FAILED` are safe unavailable errors. Provider payloads, provider URLs, keys, and raw provider messages are never returned.

## Storage and attribution boundary

No search history, cross-user geocode cache, bulk extraction, analytics warehouse, resale, or redistribution is implemented. User-selected birth coordinates are retained only through the existing encrypted birth-profile flow. This is an intended compliance model, not legal advice.

Flutter P4 must show Google Maps attribution adjacent to Google Geocoding results whenever it displays them without a Google map, using Google’s current approved logo or text treatment. Do not hide or alter that attribution. Google permits Geocoding API use without a corresponding map subject to attribution, and limits latitude/longitude caching while allowing place IDs under its policies. See [Google’s Geocoding policies](https://developers.google.com/maps/documentation/geocoding/policies?authuser=2) and [service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522).
