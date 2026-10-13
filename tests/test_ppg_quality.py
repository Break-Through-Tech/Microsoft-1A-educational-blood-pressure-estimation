from pathlib import Path
import sys
import unittest
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
from ppg_quality import inband_power_ratio


class PowerScoreTests(unittest.TestCase):
    def setUp(self):
        time = np.arange(625) / 125
        self.pulse = np.sin(2 * np.pi * 2 * time)
        self.fast_signal = np.sin(2 * np.pi * 20 * time)

    def test_signal_inside_band_scores_high(self):
        self.assertGreater(float(inband_power_ratio(self.pulse)), 0.95)

    def test_signal_outside_band_scores_low(self):
        self.assertLess(float(inband_power_ratio(self.fast_signal)), 0.05)

    def test_flat_signal_has_no_power_score(self):
        self.assertTrue(np.isnan(inband_power_ratio(np.zeros(625))))

    def test_batch_matches_individual_windows(self):
        windows = np.stack([self.pulse, self.fast_signal])
        np.testing.assert_allclose(inband_power_ratio(windows),
                                   [inband_power_ratio(w) for w in windows])


if __name__ == '__main__':
    unittest.main()
