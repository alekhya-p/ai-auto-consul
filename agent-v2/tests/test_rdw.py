"""rdw_fetch tests - parsing and cache behaviour (httpx + cache mocked)."""
from __future__ import annotations

import pytest

from tools import rdw as rdw_module
from tools.rdw import rdw_fetch, _map_row

pytestmark = pytest.mark.asyncio

ROW = {
    "kenteken": "AB123C",
    "merk": "VOLKSWAGEN",
    "handelsbenaming": "GOLF",
    "datum_eerste_toelating": "20190321",
    "datum_eerste_afgifte_nl": "20190321",
    "vervaldatum_apk": "20991231",
    "exportindicator": "Nee",
    "wam_verzekerd": "Ja",
    "openstaande_terugroepactie_indicator": "Nee",
}


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class CountingClient:
    instances: list = []

    def __init__(self, *a, **kw):
        self.gets = 0
        CountingClient.instances.append(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, params=None):
        self.gets += 1
        return FakeResponse([ROW])


@pytest.fixture(autouse=True)
def _reset():
    CountingClient.instances = []


@pytest.fixture(autouse=True)
def _bypass_cache(monkeypatch):
    async def _miss(*_a, **_kw):
        return None

    async def _noop(*_a, **_kw):
        return None

    monkeypatch.setattr(rdw_module, "get_cached_rdw", _miss)
    monkeypatch.setattr(rdw_module, "put_cached_rdw", _noop)
    monkeypatch.setattr(rdw_module.httpx, "AsyncClient", CountingClient)


async def test_parses_core_fields():
    res = await rdw_fetch("ab-123-c")
    assert res["found"] is True
    assert res["kenteken"] == "AB123C"
    assert res["make"] == "VOLKSWAGEN"
    assert res["firstRegistration"] == "2019-03-21"
    assert res["apkValid"] is True
    assert res["liabilityInsured"] is True
    assert res["openRecall"] is False


async def test_map_row_recall_flag():
    raw = {**ROW, "openstaande_terugroepactie_indicator": "Ja"}
    mapped = _map_row(raw, "AB123C")
    assert mapped["openRecall"] is True


async def test_cache_hit_skips_http(monkeypatch):
    calls = {"n": 0}

    async def _hit(_plate):
        calls["n"] += 1
        return {"found": True, "kenteken": "AB123C", "make": "VW", "cachedAt": "2026-01-01T00:00:00Z"}

    async def _noop(*_a, **_kw):
        pass

    monkeypatch.setattr(rdw_module, "get_cached_rdw", _hit)
    monkeypatch.setattr(rdw_module, "put_cached_rdw", _noop)
    res = await rdw_fetch("AB123C")
    assert res["cachedAt"]
    assert calls["n"] == 1
    assert sum(c.gets for c in CountingClient.instances) == 0


async def test_not_found_returns_found_false(monkeypatch):
    class EmptyClient(CountingClient):
        async def get(self, url, params=None):
            self.gets += 1
            return FakeResponse([])

    monkeypatch.setattr(rdw_module.httpx, "AsyncClient", EmptyClient)
    res = await rdw_fetch("ZZ000Z")
    assert res["found"] is False
