# Golden certification fixtures

The manifest reserves five fixed certification cases. Only the first has an
empty checked-in fixture template because it represents an existing production
profile and birth data must be supplied locally.

Before certification, create corresponding local-only fixture files for the
four synthetic scenarios using the same shape as
`current-production-profile.fixture.json`. Do not replace a missing expected
value with an engine value.

The five cases are: current production profile, Rashi boundary, Nakshatra/Pada
boundary, Varga boundary, and ordinary control.
