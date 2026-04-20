"""Unit tests for the Arabic text repair helper script."""

from pathlib import Path
import unittest

from scripts.fix_arabic_text import BASE_SIZE, resolve_font_path, scale_box, scale_point, shape_rtl_text


class FixArabicTextTests(unittest.TestCase):
    """Verify the pure helpers used by the repair script."""

    def test_should_shape_non_empty_arabic_text(self) -> None:
        """Ensure Arabic shaping returns a non-empty display string."""

        shaped = shape_rtl_text("عرض خاص")
        self.assertTrue(shaped)
        self.assertNotEqual(shaped, "عرض خاص")

    def test_should_raise_for_empty_text(self) -> None:
        """Ensure empty text is rejected."""

        with self.assertRaises(ValueError):
            shape_rtl_text("   ")

    def test_should_scale_box_to_double_size(self) -> None:
        """Ensure bounding boxes scale predictably."""

        box = (10, 20, 110, 220)
        scaled = scale_box(box, (BASE_SIZE[0] * 2, BASE_SIZE[1] * 2))
        self.assertEqual(scaled, (20, 40, 220, 440))

    def test_should_scale_point_to_double_size(self) -> None:
        """Ensure points scale predictably."""

        point = (12, 34)
        scaled = scale_point(point, (BASE_SIZE[0] * 2, BASE_SIZE[1] * 2))
        self.assertEqual(scaled, (24, 68))

    def test_should_resolve_existing_font_path(self) -> None:
        """Ensure at least one configured font is present on Windows."""

        self.assertTrue(resolve_font_path().exists())
        self.assertIsInstance(resolve_font_path(), Path)


if __name__ == "__main__":
    unittest.main()
