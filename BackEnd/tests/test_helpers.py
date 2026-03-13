"""
Tests for helpers.py — canon_plate, canon_text, clean_blob.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from helpers import canon_plate, canon_text, clean_blob


class TestCanonPlate:
    def test_normal_plate(self):
        assert canon_plate("1กก 1234") == "1กก1234"

    def test_plate_with_extra_spaces(self):
        assert canon_plate("  1กก   1234  ") == "1กก1234"

    def test_none_returns_none(self):
        assert canon_plate(None) is None

    def test_empty_string_returns_none(self):
        assert canon_plate("") is None

    def test_whitespace_only_returns_none(self):
        assert canon_plate("   ") is None

    def test_no_spaces(self):
        assert canon_plate("กข1234") == "กข1234"


class TestCanonText:
    def test_normal_text(self):
        assert canon_text("กรุงเทพมหานคร") == "กรุงเทพมหานคร"

    def test_text_with_whitespace(self):
        assert canon_text("  Bangkok  ") == "bangkok"

    def test_none_returns_none(self):
        assert canon_text(None) is None

    def test_empty_returns_none(self):
        assert canon_text("") is None


class TestCleanBlob:
    def test_valid_https_url(self):
        url = "https://example.com/img.jpg"
        assert clean_blob(url) == url

    def test_valid_http_url(self):
        url = "http://example.com/img.jpg"
        assert clean_blob(url) == url

    def test_none_returns_none(self):
        assert clean_blob(None) is None

    def test_empty_returns_none(self):
        assert clean_blob("") is None

    def test_dummy_string(self):
        assert clean_blob("string") is None

    def test_dummy_test(self):
        assert clean_blob("test") is None

    def test_dummy_null(self):
        assert clean_blob("null") is None

    def test_dummy_undefined(self):
        assert clean_blob("undefined") is None

    def test_dummy_case_insensitive(self):
        assert clean_blob("String") is None
        assert clean_blob("NULL") is None

    def test_invalid_scheme(self):
        assert clean_blob("ftp://example.com/img.jpg") is None

    def test_no_scheme(self):
        assert clean_blob("example.com/img.jpg") is None
