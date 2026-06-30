"""RDW date parsing edge cases."""

from tools.rdw import parse_rdw_date


def test_parse_rdw_date_year_only_does_not_raise():
    assert parse_rdw_date("2018") is None


def test_parse_rdw_date_iso_date():
    assert parse_rdw_date("2018-03-21") == "2018-03-21"


def test_parse_rdw_date_compact():
    assert parse_rdw_date("20180321") == "2018-03-21"
