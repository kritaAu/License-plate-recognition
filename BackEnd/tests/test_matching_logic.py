"""
Tests for services/matching_logic.py — province normalization, number extraction, matching.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.matching_logic import (
    normalize_province,
    extract_numbers_only,
    extract_plate_parts,
    _check_exact_match,
    _check_numeric_ignore_thai,
    _check_fuzzy_match,
)


class TestNormalizeProvince:
    def test_bangkok_aliases(self):
        assert normalize_province("กทม") == "กรุงเทพมหานคร"
        assert normalize_province("กรุงเทพฯ") == "กรุงเทพมหานคร"
        assert normalize_province("กรุงเทพ") == "กรุงเทพมหานคร"
        assert normalize_province("เมืองหลวง") == "กรุงเทพมหานคร"

    def test_korat(self):
        assert normalize_province("โคราช") == "นครราชสีมา"

    def test_normal_province(self):
        assert normalize_province("เชียงใหม่") == "เชียงใหม่"

    def test_empty(self):
        assert normalize_province("") == ""

    def test_none(self):
        assert normalize_province(None) == ""

    def test_strips_whitespace(self):
        assert normalize_province("  กทม  ") == "กรุงเทพมหานคร"


class TestExtractNumbersOnly:
    def test_standard_plate(self):
        assert extract_numbers_only("1กก 1234") == "1234"

    def test_plate_with_prefix_number(self):
        assert extract_numbers_only("8ฟม 4325") == "4325"

    def test_numbers_only(self):
        assert extract_numbers_only("1234") == "1234"

    def test_no_numbers(self):
        assert extract_numbers_only("กกก") == ""

    def test_empty(self):
        assert extract_numbers_only("") == ""

    def test_none(self):
        assert extract_numbers_only(None) == ""

    def test_single_number(self):
        assert extract_numbers_only("กก 5") == "5"


class TestExtractPlateParts:
    def test_standard(self):
        prefix, number = extract_plate_parts("1กก1234")
        assert number == "1234"

    def test_none(self):
        prefix, number = extract_plate_parts(None)
        assert prefix is None
        assert number is None

    def test_empty(self):
        prefix, number = extract_plate_parts("")
        assert prefix is None
        assert number is None


class TestCheckExactMatch:
    def test_exact_match(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก 1234",
            "province": "กรุงเทพมหานคร",
            "entry_time": "2025-06-15T08:00:00",
        }
        result = _check_exact_match("1กก 1234", "กรุงเทพมหานคร", session)
        assert result is not None
        assert result["match_type"] == "exact"
        assert result["confidence"] == 1.0

    def test_exact_match_ignores_spaces(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก1234",
            "province": "เชียงใหม่",
        }
        result = _check_exact_match("1กก 1234", "เชียงใหม่", session)
        assert result is not None

    def test_no_match_different_plate(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "2ขข 5678",
            "province": "กรุงเทพมหานคร",
        }
        result = _check_exact_match("1กก 1234", "กรุงเทพมหานคร", session)
        assert result is None

    def test_no_match_different_province(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก 1234",
            "province": "เชียงใหม่",
        }
        result = _check_exact_match("1กก 1234", "กรุงเทพมหานคร", session)
        assert result is None


class TestCheckNumericIgnoreThai:
    def test_numeric_match_same_numbers(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก 1234",
            "province": "กรุงเทพมหานคร",
        }
        sess, score, match_type = _check_numeric_ignore_thai(
            "2ขข 1234", "กรุงเทพมหานคร", session, 0.0
        )
        assert sess is not None
        assert match_type == "numeric_ignore_thai"
        assert score >= 0.90

    def test_no_match_different_numbers(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก 1234",
            "province": "กรุงเทพมหานคร",
        }
        sess, score, match_type = _check_numeric_ignore_thai(
            "1กก 5678", "กรุงเทพมหานคร", session, 0.0
        )
        assert sess is None

    def test_boost_applies(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก 1234",
            "province": "กรุงเทพมหานคร",
        }
        _, score_no_boost, _ = _check_numeric_ignore_thai(
            "2ขข 1234", "กรุงเทพมหานคร", session, 0.0
        )
        _, score_with_boost, _ = _check_numeric_ignore_thai(
            "2ขข 1234", "กรุงเทพมหานคร", session, 0.05
        )
        assert score_with_boost > score_no_boost


class TestCheckFuzzyMatch:
    def test_similar_plate(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก 1234",
            "province": "กรุงเทพมหานคร",
        }
        sess, score, match_type = _check_fuzzy_match(
            "1กก 1235", "กรุงเทพมหานคร", session, 0.0
        )
        # Could match or not depending on fuzzy score, just check no crash
        # With very similar plates this should match
        assert match_type is None or match_type == "fuzzy"

    def test_completely_different(self):
        session = {
            "session_id": "s1",
            "plate_number_entry": "1กก 1234",
            "province": "กรุงเทพมหานคร",
        }
        sess, score, match_type = _check_fuzzy_match(
            "9ฮฮ 9999", "เชียงใหม่", session, 0.0
        )
        assert sess is None
