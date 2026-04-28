# ====================== SAVE FULL ENSEMBLE MODELS WITH PREDICTION LOGIC ======================
import pickle
from google.colab import files

print("\n💾 Creating and saving FULL ENSEMBLE models (with built-in averaging)...")

# Create combined ensemble objects (contains models + scaler)
ensemble_tremor = {
    'rf': rf_t,
    'svm': svm_t,
    'scaler': scaler_t,
    'features': ['tremor_power', 'tremor_rms', 'dominant_freq', 'tremor_power_ratio']
}

ensemble_tapping = {
    'rf': rf_p,
    'svm': svm_p,
    'scaler': scaler_p,
    'features': ['total_taps', 'tap_rate', 'miss_rate', 'mean_tap_interval',
                 'std_tap_interval', 'max_freeze_gap', 'reaction_time',
                 'alternation_rate', 'sequence_effect_slope']
}

# Save as single clean files (easiest for backend)
with open('ensemble_tremor.pkl', 'wb') as f:
    pickle.dump(ensemble_tremor, f)

with open('ensemble_tapping.pkl', 'wb') as f:
    pickle.dump(ensemble_tapping, f)

print("✅ Saved 2 clean ensemble files:")
print("   • ensemble_tremor.pkl")
print("   • ensemble_tapping.pkl")

# Also save the 6 individual files (for maximum flexibility)
with open('rf_tremor.pkl', 'wb') as f:      pickle.dump(rf_t, f)
with open('svm_tremor.pkl', 'wb') as f:     pickle.dump(svm_t, f)
with open('scaler_tremor.pkl', 'wb') as f:  pickle.dump(scaler_t, f)

with open('rf_tapping.pkl', 'wb') as f:     pickle.dump(rf_p, f)
with open('svm_tapping.pkl', 'wb') as f:    pickle.dump(svm_p, f)
with open('scaler_tapping.pkl', 'wb') as f: pickle.dump(scaler_p, f)

print("✅ Also saved 6 separate files (recommended)")

# Auto download everything
files.download('ensemble_tremor.pkl')
files.download('ensemble_tapping.pkl')
files.download('rf_tremor.pkl')
files.download('svm_tremor.pkl')
files.download('scaler_tremor.pkl')
files.download('rf_tapping.pkl')
files.download('svm_tapping.pkl')
files.download('scaler_tapping.pkl')

print("\n🎉 All files downloaded!")
print("Now the backend person can load 'ensemble_tremor.pkl' and call a simple predict function.")