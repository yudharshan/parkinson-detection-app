"""
model_bundle.py — picklable classifier wrapper.

Holds the fitted scaler + RandomForest + SVM ensemble and exposes a single
predict() that returns BOTH a binary label and a continuous score, which is the
exact shape the FastAPI endpoint / app needs (binary result + a number to plot on
the symptom-over-time graph).

Kept as a class in its own module so it unpickles cleanly in the FastAPI service.
"""

import numpy as np


class EnsembleModel:
    def __init__(self, scaler, rf, svm, feature_names):
        self.scaler = scaler
        self.rf = rf
        self.svm = svm
        self.feature_names = list(feature_names)

    def predict(self, X):
        """X: array-like shape (1, n_features) in feature_names order.

        Returns:
          label            : 0 (healthy) / 1 (unhealthy)
          prediction       : "healthy" / "unhealthy"
          unhealthy_score  : P(unhealthy) in [0,1]  <- plot THIS over time
          confidence       : P of the chosen class in [0.5, 1]
        """
        X = np.asarray(X, dtype=float).reshape(1, -1)
        Xs = self.scaler.transform(X)
        p_rf = float(self.rf.predict_proba(Xs)[0][1])
        p_svm = float(self.svm.predict_proba(Xs)[0][1])
        p1 = (p_rf + p_svm) / 2.0  # ensemble P(unhealthy)
        label = int(p1 >= 0.5)
        return {
            "label": label,
            "prediction": "unhealthy" if label else "healthy",
            "unhealthy_score": round(p1, 4),
            "confidence": round(max(p1, 1 - p1), 4),
            "rf_score": round(p_rf, 4),
            "svm_score": round(p_svm, 4),
        }
