"""
Clinical Consistency Module (CCM) - CliniFusion-X
===================================================
Rule-based module that checks whether a patient's reported symptoms are
consistent with each AI-predicted disease.

Knowledge Base Source: "CliniFusion-X CCM Thoracic Clinical Knowledge Base v0.1"
Covers all 15 NIH ChestX-ray14 disease labels.

Algorithm:
    E_D = |S_D & R| / |S_D|

Where:
    S_D = set of canonical primary symptoms for disease D (from knowledge base)
    R   = set of reported symptoms (patient-reported, binary present = yes)

Evidence Labels:
    score >= 0.70             -> Supportive
    0.40 <= score < 0.70      -> Partially Supportive
    score <  0.40             -> Conflicting / Insufficient

A warning flag is raised when score < 0.40 to prompt human-in-the-loop review.

DISCLAIMER:
    Not a patient dataset, diagnostic model, or validated clinical decision rule.
    Qualitative associations require clinician review before deployment.
"""

from typing import List, Dict, Any, Optional

# -------------------------------------------------------------------------
# Disease Knowledge Base  (v0.1 - CliniFusion-X CCM Thoracic KB)
#
# Each disease entry contains:
#   primary              - common / highly characteristic symptoms (used for scoring)
#   secondary            - additional / context-dependent symptoms (informational)
#   asymptomatic_possible- True when disease can present silently
#   risk_context         - notable risk factors (informational, not scored)
#
# All symptom keys use lowercase_with_underscores format.
# -------------------------------------------------------------------------

DISEASE_KB: Dict[str, Dict[str, Any]] = {
    "Atelectasis": {
        "entity_type": "radiological_finding",
        "primary": [
            "shortness_of_breath",
            "cough",
            "chest_pain",
            "fatigue",
        ],
        "secondary": [
            "reduced_exercise_tolerance",
            "fever",
            "reduced_breath_sounds",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "recent_surgery_or_anesthesia",
            "prolonged_bed_rest",
            "mucus_plug",
            "airway_obstruction",
            "mechanical_ventilation",
        ],
    },
    "Cardiomegaly": {
        "entity_type": "radiological_finding",
        "primary": [
            "shortness_of_breath",
            "orthopnea",
            "paroxysmal_nocturnal_dyspnea",
            "fatigue",
            "reduced_exercise_tolerance",
            "palpitations",
            "chest_pain",
            "leg_swelling",
        ],
        "secondary": [
            "lightheadedness",
            "syncope",
            "abdominal_distension",
            "nausea",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "hypertension",
            "diabetes",
            "cardiomyopathy",
            "valvular_heart_disease",
            "ischemic_heart_disease",
        ],
    },
    "Consolidation": {
        "entity_type": "radiological_finding",
        "primary": [
            "cough",
            "sputum_production",
            "fever",
            "chills",
            "shortness_of_breath",
            "chest_pain",
            "fatigue",
            "malaise",
        ],
        "secondary": [
            "myalgia",
            "headache",
            "hemoptysis",
            "weight_loss",
        ],
        "asymptomatic_possible": False,
        "risk_context": [
            "pneumonia",
            "aspiration",
            "pulmonary_edema",
            "malignancy",
        ],
    },
    "Edema": {
        "entity_type": "radiological_finding",
        "primary": [
            "shortness_of_breath",
            "orthopnea",
            "paroxysmal_nocturnal_dyspnea",
            "fatigue",
            "cough",
            "wheezing",
            "leg_swelling",
        ],
        "secondary": [
            "chest_tightness",
            "pink_frothy_sputum",
            "anxiety",
        ],
        "asymptomatic_possible": False,
        "risk_context": [
            "heart_failure",
            "myocardial_injury",
            "valvular_disease",
            "severe_hypertension",
            "kidney_failure",
        ],
    },
    "Effusion": {
        "entity_type": "radiological_or_clinical_finding",
        "primary": [
            "shortness_of_breath",
            "chest_pain",
            "cough",
            "fatigue",
        ],
        "secondary": [
            "fever",
            "chills",
            "hiccups",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "heart_failure",
            "pneumonia",
            "malignancy",
            "tuberculosis",
            "liver_or_kidney_disease",
        ],
    },
    "Emphysema": {
        "entity_type": "chronic_pulmonary_disease",
        "primary": [
            "shortness_of_breath",
            "chronic_cough",
            "wheezing",
            "mucus_production",
            "chest_tightness",
            "fatigue",
        ],
        "secondary": [
            "weight_loss",
            "leg_swelling",
            "barrel_chest",
            "frequent_respiratory_infections",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "current_or_former_smoking",
            "secondhand_smoke",
            "air_pollution",
            "alpha_1_antitrypsin_deficiency",
        ],
    },
    "Fibrosis": {
        "entity_type": "chronic_pulmonary_disease_or_radiological_finding",
        "primary": [
            "shortness_of_breath",
            "dry_cough",
            "fatigue",
            "reduced_exercise_tolerance",
        ],
        "secondary": [
            "weight_loss",
            "myalgia",
            "clubbing",
            "malaise",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "environmental_or_occupational_exposure",
            "connective_tissue_disease",
            "smoking",
            "family_or_genetic_predisposition",
        ],
    },
    "Hernia": {
        "entity_type": "structural_condition",
        "primary": [
            "heartburn",
            "chest_pain",
            "dysphagia",
            "nausea",
        ],
        "secondary": [
            "dry_cough",
            "shortness_of_breath",
            "abdominal_pain",
            "epigastric_pain",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "older_age",
            "obesity",
            "smoking",
        ],
    },
    "Infiltration": {
        "entity_type": "nonspecific_radiological_finding",
        "primary": [
            "cough",
            "shortness_of_breath",
            "fever",
            "chest_pain",
            "fatigue",
        ],
        "secondary": [
            "hemoptysis",
            "weight_loss",
            "wheezing",
            "sputum_production",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "infection",
            "edema",
            "aspiration",
            "malignancy",
            "interstitial_lung_disease",
        ],
    },
    "Mass": {
        "entity_type": "radiological_finding",
        "primary": [
            "cough",
            "shortness_of_breath",
            "chest_pain",
            "hemoptysis",
            "weight_loss",
            "fatigue",
        ],
        "secondary": [
            "wheezing",
            "hoarseness",
            "night_sweats",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "smoking",
            "prior_cancer",
            "asbestos_or_occupational_exposure",
            "family_history",
        ],
    },
    "No Finding": {
        "entity_type": "negative_label",
        "primary": [],
        "secondary": [],
        "asymptomatic_possible": True,
        "risk_context": [],
    },
    "Nodule": {
        "entity_type": "radiological_finding",
        "primary": [
            "cough",
            "chest_pain",
            "shortness_of_breath",
        ],
        "secondary": [
            "hemoptysis",
            "fever",
            "weight_loss",
            "fatigue",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "older_age",
            "current_or_prior_smoking",
            "personal_history_of_cancer",
            "asbestos_exposure",
        ],
    },
    "Pleural_Thickening": {
        "entity_type": "radiological_finding",
        "primary": [
            "shortness_of_breath",
            "chest_pain",
            "cough",
            "chest_tightness",
        ],
        "secondary": [
            "dry_cough",
            "fatigue",
            "reduced_exercise_tolerance",
        ],
        "asymptomatic_possible": True,
        "risk_context": [
            "prior_pleural_infection",
            "tuberculosis",
            "asbestos_exposure",
            "malignancy",
        ],
    },
    "Pneumonia": {
        "entity_type": "infectious_pulmonary_disease",
        "primary": [
            "fever",
            "cough",
            "chills",
            "shortness_of_breath",
            "chest_pain",
            "fatigue",
            "sputum_production",
        ],
        "secondary": [
            "myalgia",
            "headache",
            "nausea",
            "night_sweats",
        ],
        "asymptomatic_possible": False,
        "risk_context": [
            "older_age",
            "chronic_lung_or_heart_disease",
            "immunosuppression",
            "recent_respiratory_infection",
            "aspiration_risk",
            "smoking",
        ],
    },
    "Pneumothorax": {
        "entity_type": "pleural_condition",
        "primary": [
            "sudden_chest_pain",
            "shortness_of_breath",
            "chest_tightness",
            "tachycardia",
        ],
        "secondary": [
            "shoulder_pain",
            "lightheadedness",
            "fatigue",
            "anxiety",
            "reduced_breath_sounds",
        ],
        "asymptomatic_possible": False,
        "risk_context": [
            "smoking",
            "tall_thin_body_habitus",
            "COPD",
            "asthma",
            "chest_trauma",
        ],
    },
}

# Convenience flat alias: primary symptoms only (backward-compatible)
SYMPTOM_KB: Dict[str, List[str]] = {
    disease: info["primary"] for disease, info in DISEASE_KB.items()
}

# -------------------------------------------------------------------------
# Synonym map: normalises free-text / UI symptom names -> canonical KB keys
# -------------------------------------------------------------------------
SYMPTOM_SYNONYM_MAP: Dict[str, str] = {
    # Breathing / Dyspnoea
    "shortness of breath":             "shortness_of_breath",
    "shortness_of_breath":             "shortness_of_breath",
    "dyspnea":                         "shortness_of_breath",
    "dyspnoea":                        "shortness_of_breath",
    "breathlessness":                  "shortness_of_breath",
    "sob":                             "shortness_of_breath",
    "difficulty breathing":            "shortness_of_breath",
    "breathing difficulty":            "shortness_of_breath",
    "progressive shortness of breath": "shortness_of_breath",
    "progressive_shortness_of_breath": "shortness_of_breath",
    "reduced exercise tolerance":      "reduced_exercise_tolerance",
    "reduced_exercise_tolerance":      "reduced_exercise_tolerance",
    "orthopnea":                       "orthopnea",
    "orthopnoea":                      "orthopnea",
    "lying flat breathlessness":       "orthopnea",
    "paroxysmal nocturnal dyspnea":    "paroxysmal_nocturnal_dyspnea",
    "paroxysmal_nocturnal_dyspnea":    "paroxysmal_nocturnal_dyspnea",
    "pnd":                             "paroxysmal_nocturnal_dyspnea",
    "chest tightness":                 "chest_tightness",
    "chest_tightness":                 "chest_tightness",
    # Cough variants
    "cough":                           "cough",
    "persistent cough":                "cough",
    "persistent_cough":                "cough",
    "dry cough":                       "dry_cough",
    "dry_cough":                       "dry_cough",
    "persistent dry cough":            "dry_cough",
    "chronic cough":                   "chronic_cough",
    "chronic_cough":                   "chronic_cough",
    "productive cough":                "sputum_production",
    "sputum":                          "sputum_production",
    "sputum production":               "sputum_production",
    "sputum_production":               "sputum_production",
    "mucus production":                "mucus_production",
    "mucus_production":                "mucus_production",
    "phlegm":                          "sputum_production",
    "hemoptysis":                      "hemoptysis",
    "blood in sputum":                 "hemoptysis",
    "coughing blood":                  "hemoptysis",
    "blood-tinged sputum":             "hemoptysis",
    # Fever / Infection
    "fever":                           "fever",
    "high temperature":                "fever",
    "pyrexia":                         "fever",
    "hyperthermia":                    "fever",
    "chills":                          "chills",
    "rigors":                          "chills",
    "night sweats":                    "night_sweats",
    "night_sweats":                    "night_sweats",
    "malaise":                         "malaise",
    "myalgia":                         "myalgia",
    "muscle aches":                    "myalgia",
    "headache":                        "headache",
    # Chest / Pain
    "chest pain":                      "chest_pain",
    "chest_pain":                      "chest_pain",
    "chest discomfort":                "chest_pain",
    "chest discomfort or pain":        "chest_pain",
    "chest_discomfort_or_pain":        "chest_pain",
    "pleuritic pain":                  "chest_pain",
    "pleuritic chest pain":            "chest_pain",
    "pleuritic_chest_pain":            "chest_pain",
    "sudden chest pain":               "sudden_chest_pain",
    "sudden_chest_pain":               "sudden_chest_pain",
    "sudden sharp chest pain":         "sudden_chest_pain",
    "shoulder pain":                   "shoulder_pain",
    "shoulder_pain":                   "shoulder_pain",
    "epigastric pain":                 "epigastric_pain",
    "epigastric_pain":                 "epigastric_pain",
    "abdominal pain":                  "abdominal_pain",
    "abdominal_pain":                  "abdominal_pain",
    # Fatigue / Constitutional
    "fatigue":                         "fatigue",
    "tiredness":                       "fatigue",
    "weakness":                        "fatigue",
    "lethargic":                       "fatigue",
    "weight loss":                     "weight_loss",
    "weight_loss":                     "weight_loss",
    "unintentional weight loss":       "weight_loss",
    "anorexia":                        "weight_loss",
    "loss of appetite":                "weight_loss",
    "poor appetite":                   "weight_loss",
    # Cardiac
    "palpitations":                    "palpitations",
    "heart racing":                    "palpitations",
    "tachycardia":                     "tachycardia",
    "fast heart rate":                 "tachycardia",
    "rapid heart rate":                "tachycardia",
    "leg swelling":                    "leg_swelling",
    "leg_swelling":                    "leg_swelling",
    "peripheral edema":                "leg_swelling",
    "peripheral_edema":                "leg_swelling",
    "ankle swelling":                  "leg_swelling",
    "ankles swollen":                  "leg_swelling",
    "lightheadedness":                 "lightheadedness",
    "dizziness":                       "lightheadedness",
    "syncope":                         "syncope",
    "fainting":                        "syncope",
    "abdominal distension":            "abdominal_distension",
    "abdominal_distension":            "abdominal_distension",
    "bloating":                        "abdominal_distension",
    # Pulmonary / Physical
    "wheezing":                        "wheezing",
    "wheeze":                          "wheezing",
    "barrel chest":                    "barrel_chest",
    "barrel_chest":                    "barrel_chest",
    "clubbing":                        "clubbing",
    "finger clubbing":                 "clubbing",
    "digital clubbing":                "clubbing",
    "reduced breath sounds":           "reduced_breath_sounds",
    "reduced_breath_sounds":           "reduced_breath_sounds",
    "decreased breath sounds":         "reduced_breath_sounds",
    "hoarseness":                      "hoarseness",
    "hoarse voice":                    "hoarseness",
    # GI / Other
    "nausea":                          "nausea",
    "vomiting":                        "nausea",
    "nausea or vomiting":              "nausea",
    "dysphagia":                       "dysphagia",
    "difficulty swallowing":           "dysphagia",
    "swallowing difficulty":           "dysphagia",
    "heartburn":                       "heartburn",
    "reflux":                          "heartburn",
    "acid reflux":                     "heartburn",
    "gerd":                            "heartburn",
    "hiccups":                         "hiccups",
    "anxiety":                         "anxiety",
    "pink frothy sputum":              "pink_frothy_sputum",
    "pink_frothy_sputum":              "pink_frothy_sputum",
}

# CCM scoring thresholds
THRESHOLD_SUPPORTIVE = 0.70
THRESHOLD_PARTIAL    = 0.40


def normalize_symptom(symptom: str) -> str:
    """Convert a raw symptom string to a canonical KB key, or return as-is lowercased."""
    cleaned = symptom.strip().lower()
    return SYMPTOM_SYNONYM_MAP.get(cleaned, cleaned.replace(" ", "_"))


class ClinicalConsistencyModule:
    """
    Evaluates clinical consistency between predicted diseases and reported symptoms.

    Usage:
        ccm = ClinicalConsistencyModule()
        result = ccm.evaluate("Pneumonia", ["fever", "cough", "fatigue"])
    """

    def evaluate(self, disease: str, reported_symptoms: List[str]) -> Dict[str, Any]:
        """
        Compute a consistency score for a predicted disease vs reported symptoms.

        Args:
            disease: Disease name matching one of the 15 NIH ChestX-ray14 labels.
            reported_symptoms: List of symptom strings (raw UI names or canonical keys).

        Returns:
            dict with keys:
                score                  (float | None) - fraction of primary expected symptoms matched
                label                  (str)          - "Supportive"|"Partially Supportive"|"Conflicting"|"N/A"
                matched                (list[str])    - canonical symptoms present in both sets
                expected               (list[str])    - primary canonical symptoms for this disease
                secondary              (list[str])    - context-dependent symptoms (informational)
                warning                (bool)         - True when clinician review is advised
                asymptomatic_possible  (bool)         - True if disease can present silently
                n_expected             (int)          - total number of primary expected symptoms
                n_reported             (int)          - number of normalised reported symptoms
        """
        kb_entry = DISEASE_KB.get(disease, None)

        # Handle unknown disease or "No Finding" - CCM is not meaningful
        if kb_entry is None or not kb_entry["primary"]:
            return {
                "score": None,
                "label": "N/A",
                "matched": [],
                "expected": [],
                "secondary": kb_entry["secondary"] if kb_entry else [],
                "warning": False,
                "asymptomatic_possible": kb_entry["asymptomatic_possible"] if kb_entry else True,
                "n_expected": 0,
                "n_reported": len(reported_symptoms),
            }

        # Normalize all reported symptoms to canonical keys
        normalized_reported = set(
            normalize_symptom(s) for s in reported_symptoms if s.strip()
        )

        expected_set = set(kb_entry["primary"])
        matched = sorted(expected_set & normalized_reported)
        score = len(matched) / len(expected_set)

        if score >= THRESHOLD_SUPPORTIVE:
            label, warning = "Supportive", False
        elif score >= THRESHOLD_PARTIAL:
            label, warning = "Partially Supportive", False
        else:
            label, warning = "Conflicting", True

        return {
            "score": round(score, 3),
            "label": label,
            "matched": matched,
            "expected": sorted(kb_entry["primary"]),
            "secondary": sorted(kb_entry["secondary"]),
            "warning": warning,
            "asymptomatic_possible": kb_entry["asymptomatic_possible"],
            "n_expected": len(expected_set),
            "n_reported": len(normalized_reported),
        }

    def evaluate_all(
        self,
        findings: List[Dict[str, Any]],
        reported_symptoms: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Enrich a list of inference findings with CCM results.

        Args:
            findings: Output list from InferenceEngine.predict()
            reported_symptoms: Flat list of reported symptom strings

        Returns:
            Same findings list with added keys: ccm_score, ccm_label,
            ccm_matched, ccm_expected, ccm_warning, ccm_secondary,
            ccm_asymptomatic_possible
        """
        enriched = []
        for finding in findings:
            disease = finding.get("disease", "")
            ccm_result = self.evaluate(disease, reported_symptoms)
            enriched.append({
                **finding,
                "ccm_score":                  ccm_result["score"],
                "ccm_label":                  ccm_result["label"],
                "ccm_matched":                ccm_result["matched"],
                "ccm_expected":               ccm_result["expected"],
                "ccm_warning":                ccm_result["warning"],
                "ccm_secondary":              ccm_result["secondary"],
                "ccm_asymptomatic_possible":  ccm_result["asymptomatic_possible"],
            })
        return enriched

    def get_risk_context(self, disease: str) -> List[str]:
        """
        Return the list of known risk factors for a disease.

        Args:
            disease: Disease name matching one of the 15 NIH ChestX-ray14 labels.

        Returns:
            List of risk context strings (informational only, not scored).
        """
        kb_entry = DISEASE_KB.get(disease)
        return kb_entry.get("risk_context", []) if kb_entry else []