"""Measure the share of PPG power between 0.5 and 8 Hz."""
import numpy as np
from scipy.signal import welch


def inband_power_ratio(ppg, fs=125):
    frequencies, power = welch(ppg, fs=fs, nperseg=256, axis=-1)
    band = (frequencies >= 0.5) & (frequencies <= 8)
    total = power.sum(axis=-1)
    return np.divide(power[..., band].sum(axis=-1), total,
                     out=np.full_like(total, np.nan, dtype=float), where=total > 0)
