"""tests for the ssrf guard."""
import pytest

from etl_pipeline import net_guard
from etl_pipeline.net_guard import (UnsafeURLError, assert_https_scheme,
                                    assert_public_url, ip_is_public)


def test_ip_is_public_true_for_routable():
    assert ip_is_public("8.8.8.8") is True


@pytest.mark.parametrize("ip", ["127.0.0.1", "10.0.0.1", "192.168.1.5",
                                "169.254.169.254", "::1"])
def test_ip_is_public_false_for_reserved(ip):
    assert ip_is_public(ip) is False


def test_assert_https_scheme_rejects_non_http():
    with pytest.raises(UnsafeURLError):
        assert_https_scheme("ftp://example.com")


def test_assert_https_scheme_allows_https():
    assert_https_scheme("https://example.com")  # does not raise


def test_assert_public_url_rejects_missing_host():
    with pytest.raises(UnsafeURLError):
        assert_public_url("https://")


def test_assert_public_url_rejects_private_host(monkeypatch):
    monkeypatch.setattr(net_guard, "_resolve_ips", lambda host: ["10.0.0.5"])
    with pytest.raises(UnsafeURLError):
        assert_public_url("https://internal.example.com")


def test_assert_public_url_allows_public_host(monkeypatch):
    monkeypatch.setattr(net_guard, "_resolve_ips", lambda host: ["93.184.216.34"])
    assert_public_url("https://example.com/path")  # does not raise


def test_resolve_ips_returns_addresses(monkeypatch):
    monkeypatch.setattr(net_guard.socket, "getaddrinfo",
                        lambda host, port: [(2, 1, 6, "", ("93.184.216.34", 0))])
    assert net_guard._resolve_ips("example.com") == ["93.184.216.34"]


def test_resolve_ips_raises_on_dns_failure(monkeypatch):
    def fail(host, port):
        raise net_guard.socket.gaierror("no such host")

    monkeypatch.setattr(net_guard.socket, "getaddrinfo", fail)
    with pytest.raises(UnsafeURLError):
        net_guard._resolve_ips("nope.invalid")
