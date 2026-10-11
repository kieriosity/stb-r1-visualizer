"""Offline generator regressions; run with python -m unittest discover -s scripts."""
import importlib.util
from pathlib import Path
import tempfile
import unittest


spec = importlib.util.spec_from_file_location('gen_template', Path(__file__).with_name('gen-form-template.py'))
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class PageBoundaryTests(unittest.TestCase):
    def test_combined_split_keeps_header_and_every_row(self):
        rows = [{'cells': [{'c': 0, 't': text}]} for text in [
            '501. GUARANTIES', '1', 'Railroad Annual Report R-1',
            'Road Initials: Year:', '502. BORROWING', 'Disclosure']]
        grid = {'rows': rows, 'cols': [12], 'rowBreaks': [3]}
        first, second = generator._split_combined(grid, ['501', '502'])
        self.assertEqual(first['rows'], rows[:3])
        self.assertEqual(second['rows'], rows[3:])
        self.assertNotIn('rowBreaks', first)
        self.assertEqual(first['rows'] + second['rows'], rows)

    def test_split_does_not_pull_data_across_a_break(self):
        rows = [{'cells': [{'c': 0, 't': text}]} for text in [
            '501. GUARANTIES', 'Contract still on 501', '502. BORROWING']]
        first, second = generator._split_combined({'rows': rows, 'cols': [12], 'rowBreaks': [1]}, ['501','502'])
        self.assertEqual(first['rows'], rows[:2])
        self.assertEqual(second['rows'], rows[2:])

    def test_reviewed_boundaries_preserve_every_cell_and_row(self):
        workbook = generator.openpyxl.load_workbook(generator.FORMS[-1][1], data_only=True)
        for name, review in generator.reviewed_boundaries(generator.FORMS[-1][1]).items():
            with self.subTest(sheet=name):
                before = generator.extract_sheet(workbook[name])
                after = generator.extract_sheet(workbook[name], review['breaks_after_rows'])
                self.assertEqual(before['rows'], after['rows'])
                self.assertEqual(before['cols'], after['cols'])
                self.assertEqual(len(after['rowBreaks']) + 1, len(review['pdf_pages']))

    def test_changed_source_cannot_reuse_reviewed_coordinates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / generator.FORMS[-1][1].name
            path.write_bytes(b'changed workbook')
            with self.assertRaisesRegex(ValueError, 'source changed'):
                generator.reviewed_boundaries(path)


if __name__ == '__main__':
    unittest.main()
