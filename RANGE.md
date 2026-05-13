# Laboratory Reference Ranges — Full Documentation

> **Version:** 1.0 · **Date:** 2026-03-06  
> **Source:** `backend/src/database/seed-test-catalog.ts` & associated schemas  
> All price values are in Nigerian Naira (₦). TAT = turnaround time in minutes.

---

## Table of Contents

1. [How Dynamic Ranges Work](#1-how-dynamic-ranges-work)
2. [Hematology](#2-hematology)
3. [Clinical Chemistry](#3-clinical-chemistry)
4. [Electrolytes](#4-electrolytes)
5. [Immunoassay & POCT](#5-immunoassay--poct)
6. [Thyroid Function](#6-thyroid-function)
7. [Reproductive Hormones](#7-reproductive-hormones)
8. [Tumor Markers](#8-tumor-markers)
9. [Cardiac Markers](#9-cardiac-markers)
10. [Coagulation Tests](#10-coagulation-tests)
11. [Inflammation & Infection Markers](#11-inflammation--infection-markers)
12. [Vitamins & Minerals](#12-vitamins--minerals)
13. [Renal & Special Markers](#13-renal--special-markers)
14. [Microbiology & Serology](#14-microbiology--serology)
15. [Urinalysis](#15-urinalysis)
16. [Critical Values Summary](#16-critical-values-summary)
17. [Test Panels (Bundled Tests)](#17-test-panels-bundled-tests)

---

## 1. How Dynamic Ranges Work

Every test in the system stores one or more `ReferenceRangeItem` objects. At result-interpretation time the correct range is selected by matching **all applicable fields** in priority order:

```
Patient Profile
│
├── pregnancy flag  →  use pregnancy-specific range if available
├── condition       →  use condition-specific range (e.g. Follicular, Luteal)
├── gender (M/F/all)
└── age (years)     →  ageMin ≤ patient_age < ageMax
                       (missing ageMax = no upper bound)
```

### ReferenceRangeItem Schema

| Field         | Type    | Description |
|---------------|---------|-------------|
| `ageGroup`    | string  | Human-readable label, e.g. "Adult Male" |
| `ageMin`      | number  | Minimum age in **years** (inclusive) |
| `ageMax`      | number  | Maximum age in **years** (exclusive, optional) |
| `gender`      | M/F/all | Patient sex filter |
| `pregnancy`   | boolean | Override for pregnant patients |
| `condition`   | string  | Hormone-cycle phase or time-of-day condition |
| `range`       | string  | The reference interval, e.g. "13.5-17.5" |
| `unit`        | string  | Unit for this specific interval |
| `criticalLow` | string  | Alert threshold — critically low |
| `criticalHigh`| string  | Alert threshold — critically high |

> **Age encoding for neonates/infants:**  
> Values < 1 are fractions of a year. For example:  
> `0.02 yr ≈ 7 days` · `0.04 yr ≈ 2 weeks` · `0.08 yr ≈ 1 month` · `0.5 yr ≈ 6 months`

---

## 2. Hematology

Machine: **ZYBIO ZS-2 Haematology Analyser**

---

### 2.1 Hemoglobin (HB)
**Code:** `HB` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** g/dL

| Age Group | Age Range | Gender | Reference Range | Critical Low | Critical High |
|-----------|-----------|--------|-----------------|-------------|--------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 17.0 – 20.0 | **7.0** | **24.0** |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 12.0 – 16.0 | **7.0** | **20.0** |
| Adult Female | ≥ 13 yr | F | 11.5 – 15.0 | **7.0** | **20.0** |
| Adult Male | ≥ 13 yr | M | 13.5 – 17.5 | **7.0** | **20.0** |

---

### 2.2 Hematocrit (HCT)
**Code:** `HCT` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** %

| Age Group | Age Range | Gender | Reference Range | Critical Low | Critical High |
|-----------|-----------|--------|-----------------|-------------|--------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 38.0 – 68.0 | **20** | **70** |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 35.0 – 49.0 | **20** | **60** |
| Adult Female | ≥ 13 yr | F | 35.0 – 45.0 | **20** | **60** |
| Adult Male | ≥ 13 yr | M | 40.0 – 54.0 | **20** | **60** |

---

### 2.3 Red Blood Cell Count (RBC)
**Code:** `RBC` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** x10¹²/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 3.50 – 7.00 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 3.50 – 5.20 |
| Adult Female | ≥ 13 yr | F | 3.80 – 5.10 |
| Adult Male | ≥ 13 yr | M | 4.50 – 5.90 |

---

### 2.4 White Blood Cell Count (WBC)
**Code:** `WBC` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** x10⁹/L

| Age Group | Age Range | Gender | Reference Range | Critical Low | Critical High |
|-----------|-----------|--------|-----------------|-------------|--------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 4.00 – 20.00 | **2.0** | **30.0** |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 4.00 – 12.00 | **2.0** | **30.0** |
| Adult Female | ≥ 13 yr | F | 3.50 – 9.50 | **2.0** | **30.0** |
| Adult Male | ≥ 13 yr | M | 4.00 – 11.00 | **2.0** | **30.0** |

---

### 2.5 Platelet Count (PLT)
**Code:** `PLT` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** x10⁹/L

| Age Group | Age Range | Gender | Reference Range | Critical Low | Critical High |
|-----------|-----------|--------|-----------------|-------------|--------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 100 – 300 | **50** | **1000** |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 100 – 300 | **50** | **1000** |
| Adult | ≥ 13 yr | All | 125 – 350 | **50** | **1000** |

---

### 2.6 Mean Corpuscular Volume (MCV)
**Code:** `MCV` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** fL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 95.0 – 125.0 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 80.0 – 100.0 |
| Adult | ≥ 13 yr | All | 82.0 – 100.0 |

---

### 2.7 Mean Corpuscular Hemoglobin (MCH)
**Code:** `MCH` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** pg

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 30.0 – 42.0 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 27.0 – 34.0 |
| Adult | ≥ 13 yr | All | 27.0 – 34.0 |

---

### 2.8 Mean Corpuscular Hemoglobin Concentration (MCHC)
**Code:** `MCHC` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** g/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 300 – 340 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 310 – 370 |
| Adult | ≥ 13 yr | All | 316 – 354 |

---

### 2.9 Red Cell Distribution Width (RDW)
**Code:** `RDW` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** %

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| All ages | ≥ 0 yr | All | 11.5 – 14.5 |

---

### 2.10 RDW-CV (RDWCV) *(Analyzer-derived)*
**Code:** `RDWCV` | **Price:** ₦0 — included in FBC | **Sample:** Blood | **Unit:** %

> Erythrocyte anisocytosis index — coefficient of variation

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 11.0 – 16.0 |

---

### 2.11 RDW-SD (RDWSD) *(Analyzer-derived)*
**Code:** `RDWSD` | **Price:** ₦0 — included in FBC | **Sample:** Blood | **Unit:** fL

> Erythrocyte anisocytosis index — standard deviation

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 35.0 – 56.0 |

---

### 2.12 Mean Platelet Volume (MPV)
**Code:** `MPV` | **Price:** ₦0 — included in FBC | **Sample:** Blood | **Unit:** fL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 6.5 – 12.0 |

---

### 2.13 Platelet Distribution Width (PDW)
**Code:** `PDW` | **Price:** ₦0 — included in FBC | **Sample:** Blood | **Unit:** fL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 9.0 – 17.0 |

---

### 2.14 Plateletcrit (PLTCT)
**Code:** `PLTCT` | **Price:** ₦0 — included in FBC | **Sample:** Blood | **Unit:** mL/L

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 1.08 – 2.82 |

---

### 2.15 Platelet Large Cell Ratio (PLCR)
**Code:** `PLCR` | **Price:** ₦0 — included in FBC | **Sample:** Blood | **Unit:** %

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 11.0 – 45.0 |

---

### 2.16 Platelet Large Cell Count (PLCC)
**Code:** `PLCC` | **Price:** ₦0 — included in FBC | **Sample:** Blood | **Unit:** x10⁹/L

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 30 – 90 |

---

### 2.17 Differential Count — Absolute Values

#### Neutrophils # (NEUTA)
**Code:** `NEUTA` | **Unit:** x10⁹/L

| Age Group | Age Range | Gender | Reference Range | Critical Low |
|-----------|-----------|--------|-----------------|-------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 1.60 – 16.00 | **1.0** |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 2.00 – 8.00 | **1.0** |
| Adult | ≥ 13 yr | All | 1.80 – 6.30 | **1.0** |

#### Lymphocytes # (LYMPHA)
**Code:** `LYMPHA` | **Unit:** x10⁹/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 0.40 – 12.00 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 0.80 – 7.00 |
| Adult | ≥ 13 yr | All | 1.10 – 3.20 |

#### Monocytes # (MONOA)
**Code:** `MONOA` | **Unit:** x10⁹/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 0.12 – 2.50 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 0.12 – 1.20 |
| Adult | ≥ 13 yr | All | 0.10 – 0.60 |

#### Eosinophils # (EOSA)
**Code:** `EOSA` | **Unit:** x10⁹/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 0.02 – 0.80 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 0.02 – 0.80 |
| Adult | ≥ 13 yr | All | 0.02 – 0.52 |

#### Basophils # (BASOA)
**Code:** `BASOA` | **Unit:** x10⁹/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 0.00 – 0.20 |
| Pediatric (7d – 13yr) | 0.02 – 13 yr | All | 0.00 – 0.10 |
| Adult | ≥ 13 yr | All | 0.00 – 0.06 |

---

### 2.18 Differential Count — Percentage Values

#### Neutrophils % (NEUT) — *Legacy / Inactive*
**Code:** `NEUT` | **Unit:** %

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Newborn (0-2 wks) | 0 – 0.04 yr | All | 40 – 80 |
| 2 weeks – 1 month | 0.04 – 0.08 yr | All | 30 – 60 |
| 1 – 6 months | 0.08 – 0.5 yr | All | 20 – 40 |
| 6 months – 2 years | 0.5 – 2 yr | All | 25 – 45 |
| 2 – 6 years | 2 – 6 yr | All | 30 – 55 |
| 6 – 12 years | 6 – 12 yr | All | 35 – 65 |
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 40.0 – 80.0 |
| Pediatric (7d-13yr) | 0.02 – 13 yr | All | 50.0 – 70.0 |
| Adult | ≥ 13 yr | All | 40.0 – 75.0 |

#### Lymphocytes % (LYMPH) — *Legacy / Inactive*
**Code:** `LYMPH` | **Unit:** %

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Newborn (0-2 wks) | 0 – 0.04 yr | All | 20 – 50 |
| 2 weeks – 1 month | 0.04 – 0.08 yr | All | 35 – 65 |
| 1 – 6 months | 0.08 – 0.5 yr | All | 50 – 70 |
| 6 months – 2 years | 0.5 – 2 yr | All | 45 – 75 |
| 2 – 6 years | 2 – 6 yr | All | 35 – 60 |
| 6 – 12 years | 6 – 12 yr | All | 25 – 50 |
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 10.0 – 60.0 |
| Pediatric (7d-13yr) | 0.02 – 13 yr | All | 20.0 – 60.0 |
| Adult | ≥ 13 yr | All | 20.0 – 50.0 |

#### Monocytes % (MONO) — *Legacy / Inactive*
**Code:** `MONO` | **Unit:** %

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Newborn (0-2 wks) | 0 – 0.04 yr | All | 3 – 10 |
| 2 weeks – 1 month | 0.04 – 0.08 yr | All | 3 – 10 |
| 1 – 6 months | 0.08 – 0.5 yr | All | 3 – 10 |
| 6 months – 2 years | 0.5 – 2 yr | All | 3 – 10 |
| 2 – 6 years | 2 – 6 yr | All | 2 – 10 |
| 6 – 12 years | 6 – 12 yr | All | 2 – 10 |
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 3.0 – 13.0 |
| Pediatric (7d-13yr) | 0.02 – 13 yr | All | 3.0 – 12.0 |
| Adult | ≥ 13 yr | All | 3.0 – 10.0 |

#### Eosinophils % (EOS) — *Legacy / Inactive*
**Code:** `EOS` | **Unit:** %

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Newborn (0-2 wks) | 0 – 0.04 yr | All | 0 – 4 |
| 2 weeks – 1 month | 0.04 – 0.08 yr | All | 0 – 4 |
| 1 – 6 months | 0.08 – 0.5 yr | All | 0 – 5 |
| 6 months – 2 years | 0.5 – 2 yr | All | 0 – 5 |
| 2 – 6 years | 2 – 6 yr | All | 0 – 6 |
| 6 – 12 years | 6 – 12 yr | All | 0 – 6 |
| Neonatal (0-7 days) | 0 – 0.02 yr | All | 0.5 – 5.0 |
| Pediatric (7d-13yr) | 0.02 – 13 yr | All | 0.5 – 5.0 |
| Adult | ≥ 13 yr | All | 0.4 – 8.0 |

#### Basophils % (BASO) — *Legacy / Inactive*
**Code:** `BASO` | **Unit:** %

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Newborn (0-2 wks) | 0 – 0.04 yr | All | 0 – 1 |
| 2 weeks – 1 month | 0.04 – 0.08 yr | All | 0 – 1 |
| 1 – 6 months | 0.08 – 0.5 yr | All | 0 – 1 |
| 6 months – 2 years | 0.5 – 2 yr | All | 0 – 1 |
| 2 – 6 years | 2 – 6 yr | All | 0 – 1 |
| 6 – 12 years | 6 – 12 yr | All | 0 – 1 |
| All ages | ≥ 0 yr | All | 0.0 – 1.0 |

---

### 2.19 Erythrocyte Sedimentation Rate (ESR)
**Code:** `ESR` | **Price:** ₦80 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mm/hr

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Newborn | 0 – 0.04 yr | All | 0 – 2 |
| Child | 0.04 – 18 yr | All | 0 – 10 |
| Adult Male | 18 – 50 yr | M | 0 – 15 |
| Adult Female | 18 – 50 yr | F | 0 – 20 |
| Elderly Male | ≥ 50 yr | M | 0 – 20 |
| Elderly Female | ≥ 50 yr | F | 0 – 30 |

---

### 2.20 Full Blood Count (FBC) — Panel
**Code:** `FBC` | **Price:** ₦150 | **Sample:** Blood | **TAT:** 60 min  
> Complete blood count with differential. Results reported as component tests (HB, HCT, RBC, WBC, PLT, MCV, MCH, MCHC, RDWCV, RDWSD, MPV, PDW, PLTCT, PLCR, PLCC + differential).

---

## 3. Clinical Chemistry

Machine: **ZYBIO EXC-200 Chemistry Analyser**

---

### 3.1 Alanine Aminotransferase (ALT)
**Code:** `ALT` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** U/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult Male | 18 – 65 yr | M | 7 – 56 |
| Adult Female | 18 – 65 yr | F | 7 – 45 |
| Elderly | ≥ 65 yr | All | 7 – 50 |

---

### 3.2 Aspartate Aminotransferase (AST)
**Code:** `AST` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** U/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult Male | 18 – 65 yr | M | 10 – 40 |
| Adult Female | 18 – 65 yr | F | 10 – 35 |
| Elderly | ≥ 65 yr | All | 10 – 40 |

---

### 3.3 Alkaline Phosphatase (ALP)
**Code:** `ALP` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** U/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Newborn | 0 – 0.08 yr | All | 75 – 400 |
| 1 month – 1 year | 0.08 – 1 yr | All | 82 – 383 |
| 1 – 3 years | 1 – 3 yr | All | 104 – 345 |
| 4 – 6 years | 4 – 6 yr | All | 93 – 309 |
| 7 – 9 years | 7 – 9 yr | All | 69 – 325 |
| 10 – 12 years | 10 – 12 yr | All | 42 – 362 |
| 13 – 15 years | 13 – 15 yr | M | 74 – 390 |
| 13 – 15 years | 13 – 15 yr | F | 50 – 162 |
| 16 – 18 years | 16 – 18 yr | M | 52 – 171 |
| 16 – 18 years | 16 – 18 yr | F | 47 – 119 |
| Adult | 18 – 65 yr | All | 44 – 147 |
| Elderly | ≥ 65 yr | All | 44 – 147 |

> **Note:** ALP is heavily age-dependent, especially during bone growth phases in childhood and adolescence.

---

### 3.4 Gamma-Glutamyl Transferase (GGT)
**Code:** `GGT` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** U/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult Male | ≥ 18 yr | M | 8 – 61 |
| Adult Female | ≥ 18 yr | F | 5 – 36 |

---

### 3.5 Total Bilirubin (TBIL)
**Code:** `TBIL` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Age Group | Age Range | Gender | Reference Range | Critical High |
|-----------|-----------|--------|-----------------|--------------|
| Newborn (0-24 hr) | 0 – 0.003 yr | All | 1.0 – 12.0 | **15.0** |
| Newborn (3-5 days) | 0.008 – 0.014 yr | All | 1.5 – 12.0 | **15.0** |
| Child (6d – 18yr) | 0.016 – 18 yr | All | 0.3 – 1.2 | — |
| Adult | ≥ 18 yr | All | 0.3 – 1.2 | **15.0** |

---

### 3.6 Direct Bilirubin (DBIL)
**Code:** `DBIL` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 0.0 – 0.3 |

---

### 3.7 Indirect Bilirubin (IBIL) *(Calculated)*
**Code:** `IBIL` | **Price:** ₦0 — calculated (Total Bilirubin − Direct Bilirubin) | **Unit:** mg/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 0.2 – 0.8 |

---

### 3.8 Total Protein (TP)
**Code:** `TP` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** g/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 6.0 – 8.3 |

---

### 3.9 Albumin (ALB)
**Code:** `ALB` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** g/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 3.5 – 5.5 |

---

### 3.10 Globulin (GLOB) *(Calculated)*
**Code:** `GLOB` | **Price:** ₦0 — calculated (Total Protein − Albumin) | **Unit:** g/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 2.0 – 3.5 |

---

### 3.11 Creatinine (CREAT)
**Code:** `CREAT` | **Price:** ₦90 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Age Group | Age Range | Gender | Reference Range | Critical High |
|-----------|-----------|--------|-----------------|--------------|
| Infant (0-1 yr) | 0 – 1 yr | All | 0.2 – 0.4 | — |
| Child (1-12 yr) | 1 – 12 yr | All | 0.3 – 0.7 | — |
| Adolescent (12-18 yr) | 12 – 18 yr | All | 0.5 – 1.0 | — |
| Adult Male | 18 – 65 yr | M | 0.7 – 1.3 | **5.0** |
| Adult Female | 18 – 65 yr | F | 0.6 – 1.1 | **5.0** |
| Elderly Male | ≥ 65 yr | M | 0.8 – 1.3 | — |
| Elderly Female | ≥ 65 yr | F | 0.6 – 1.2 | — |

---

### 3.12 Urea (UREA)
**Code:** `UREA` | **Price:** ₦80 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Child | 0 – 18 yr | All | 5 – 18 |
| Adult | 18 – 65 yr | All | 7 – 20 |
| Elderly | ≥ 65 yr | All | 8 – 23 |

---

### 3.13 Uric Acid (UA)
**Code:** `UA` | **Price:** ₦80 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Child | 0 – 18 yr | All | 2.0 – 5.5 |
| Adult Male | ≥ 18 yr | M | 3.5 – 7.2 |
| Adult Female (premenopausal) | 18 – 50 yr | F | 2.6 – 6.0 |
| Adult Female (postmenopausal) | ≥ 50 yr | F | 3.5 – 7.2 |

---

### 3.14 Total Cholesterol (CHOL)
**Code:** `CHOL` | **Price:** ₦80 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Desirable | ≥ 18 yr | All | < 200 |
| Borderline High | ≥ 18 yr | All | 200 – 239 |
| High | ≥ 18 yr | All | ≥ 240 |

---

### 3.15 Triglycerides (TG)
**Code:** `TG` | **Price:** ₦80 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Desirable | ≥ 18 yr | All | < 150 |
| Borderline High | ≥ 18 yr | All | 150 – 199 |
| High | ≥ 18 yr | All | ≥ 200 |

---

### 3.16 HDL Cholesterol (HDL)
**Code:** `HDL` | **Price:** ₦200 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Optimal (Male) | ≥ 18 yr | M | > 40 |
| Optimal (Female) | ≥ 18 yr | F | > 50 |

---

### 3.17 LDL Cholesterol (LDL)
**Code:** `LDL` | **Price:** ₦150 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Optimal | ≥ 18 yr | All | < 100 |
| Near Optimal | ≥ 18 yr | All | 100 – 129 |
| Borderline High | ≥ 18 yr | All | 130 – 159 |
| High | ≥ 18 yr | All | ≥ 160 |

---

### 3.18 VLDL Cholesterol (VLDL) *(Calculated)*
**Code:** `VLDL` | **Price:** ₦0 — calculated (Triglycerides ÷ 5) | **Unit:** mg/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | < 30 |

---

### 3.19 Fasting Blood Glucose (GLU)
**Code:** `GLU` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Interpretation Category | Age Range | Gender | Range | Critical Low | Critical High |
|------------------------|-----------|--------|-------|-------------|--------------|
| Normal | ≥ 18 yr | All | 70 – 100 | **50** | **500** |
| Prediabetes | ≥ 18 yr | All | 100 – 125 | — | — |
| Diabetes | ≥ 18 yr | All | ≥ 126 | — | — |

---

### 3.20 Random Blood Sugar (RBS)
**Code:** `RBS` | **Price:** ₦50 | **Sample:** Blood | **TAT:** 60 min | **Unit:** mg/dL

| Interpretation Category | Age Range | Gender | Range | Critical Low | Critical High |
|------------------------|-----------|--------|-------|-------------|--------------|
| Normal | ≥ 18 yr | All | < 140 | **50** | **500** |
| Prediabetes | ≥ 18 yr | All | 140 – 199 | — | — |
| Diabetes | ≥ 18 yr | All | ≥ 200 | — | — |

---

### 3.21 Iron (FE)
**Code:** `FE` | **Price:** ₦80 | **Sample:** Blood | **TAT:** 120 min | **Unit:** µg/dL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Male | ≥ 18 yr | M | 65 – 175 |
| Female | ≥ 18 yr | F | 50 – 170 |

---

### 3.22 Magnesium (MG)
**Code:** `MG` | **Price:** ₦150 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 1.7 – 2.2 |

---

### 3.23 Zinc (ZN)
**Code:** `ZN` | **Price:** ₦150 | **Sample:** Blood | **TAT:** 120 min | **Unit:** µg/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 70 – 120 |

---

### 3.24 Carbon Dioxide (CO2)
**Code:** `CO2` | **Price:** ₦80 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mmol/L

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 23 – 29 |

---

### 3.25 Total Carbon Dioxide (TCO2)
**Code:** `TCO2` | **Price:** ₦35 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mmol/L

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 22 – 28 |

---

### 3.26 Lactate Dehydrogenase (LDH)
**Code:** `LDH` | **Price:** ₦180 | **Sample:** Blood | **TAT:** 120 min | **Unit:** U/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult | ≥ 18 yr | All | 140 – 280 |

---

### 3.27 Liver Function Test — Panel (LFT)
**Code:** `LFT` | **Price:** ₦320 | **Sample:** Blood | **TAT:** 180 min  
> Bundled panel: ALT, AST, ALP, GGT, TBIL, DBIL, TP, ALB

---

### 3.28 Renal Function Test — Panel (RFT)
**Code:** `RFT` | **Price:** ₦400 | **Sample:** Blood | **TAT:** 180 min  
> Bundled panel: CREAT, UREA, UA + Electrolytes

---

### 3.29 Lipid Profile — Panel (LIPID)
**Code:** `LIPID` | **Price:** ₦320 | **Sample:** Blood | **TAT:** 180 min  
> Bundled panel: CHOL, TG, HDL, LDL, VLDL

---

## 4. Electrolytes

Machine: **CBS-50 Electrolyte Analyser**

---

### 4.1 Sodium (NA)
**Code:** `NA` | **Price:** ₦35 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mmol/L

| Age Group | Gender | Reference Range | Critical Low | Critical High |
|-----------|--------|-----------------|-------------|--------------|
| All ages | All | 136 – 145 | **120** | **160** |

---

### 4.2 Potassium (K)
**Code:** `K` | **Price:** ₦35 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mmol/L

| Age Group | Gender | Reference Range | Critical Low | Critical High |
|-----------|--------|-----------------|-------------|--------------|
| All ages | All | 3.5 – 5.1 | **2.5** | **6.5** |

---

### 4.3 Chloride (CL)
**Code:** `CL` | **Price:** ₦35 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mmol/L

| Age Group | Gender | Reference Range | Critical Low | Critical High |
|-----------|--------|-----------------|-------------|--------------|
| All ages | All | 98 – 107 | **80** | **115** |

---

### 4.4 Calcium (CA)
**Code:** `CA` | **Price:** ₦35 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mg/dL

| Age Group | Gender | Reference Range | Critical Low | Critical High |
|-----------|--------|-----------------|-------------|--------------|
| All ages | All | 8.5 – 10.5 | **7.0** | **13.0** |

---

### 4.5 Bicarbonate (HCO3)
**Code:** `HCO3` | **Price:** ₦35 | **Sample:** Blood | **TAT:** 120 min | **Unit:** mmol/L

| Age Group | Gender | Reference Range | Critical Low | Critical High |
|-----------|--------|-----------------|-------------|--------------|
| All ages | All | 22 – 29 | **15** | **40** |

---

### 4.6 Electrolyte Panel (ELEC)
**Code:** `ELEC` | **Price:** ₦140 | **Sample:** Blood | **TAT:** 120 min  
> Bundled panel: NA, K, CL, CA, HCO3

---

## 5. Immunoassay & POCT

Machine: **Wondfo Finecare FIA System**

---

### 5.1 Glycated Hemoglobin (HBA1C)
**Code:** `HBA1C` | **Price:** ₦170 | **Sample:** Blood | **TAT:** 180 min | **Unit:** %

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 18 yr | All | < 5.7 |
| Prediabetes | ≥ 18 yr | All | 5.7 – 6.4 |
| Diabetes | ≥ 18 yr | All | ≥ 6.5 |

---

### 5.2 C-Reactive Protein (CRP)
**Code:** `CRP` | **Price:** ₦190 | **Sample:** Blood | **TAT:** 30 min | **Unit:** mg/L

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | 0 – 10.0 |

---

### 5.3 High Sensitivity CRP (HSCR)
**Code:** `HSCR` | **Price:** ₦350 | **Sample:** Blood | **TAT:** 30 min | **Unit:** mg/L

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | 0 – 1.0 |

---

### 5.4 Procalcitonin (PCT)
**Code:** `PCT` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Interpretation Category | Age Range | Gender | Range | Critical High |
|------------------------|-----------|--------|-------|--------------|
| Normal | ≥ 0 yr | All | < 0.5 | — |
| Possible Bacterial Infection | ≥ 0 yr | All | 0.5 – 2.0 | — |
| Sepsis Likely | ≥ 0 yr | All | > 2.0 | **2.0** |

---

### 5.5 D-Dimer (DDIMER)
**Code:** `DDIMER` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 30 min | **Unit:** µg/mL FEU

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | < 0.5 |
| Elevated | ≥ 0 yr | All | > 0.5 |

---

### 5.6 D-Dimer — One Step (DDIMER_OS)
**Code:** `DDIMER_OS` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 30 min | **Unit:** µg/mL FEU

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | < 0.5 |
| Elevated | ≥ 0 yr | All | ≥ 0.5 |

---

### 5.7 Microalbumin — One Step (MAU Urine)
**Code:** `MAU` *(urine rapid)* | **Price:** ₦130 | **Sample:** Urine | **TAT:** 30 min | **Unit:** mg/L

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | < 20 |
| Microalbuminuria | ≥ 0 yr | All | 20 – 200 |
| Macroalbuminuria | ≥ 0 yr | All | > 200 |

---

### 5.8 Microalbumin — Immunoassay (MAU Immunoassay)
**Code:** `MAU` *(immunoassay)* | **Price:** ₦200 | **Sample:** Urine | **TAT:** 30 min | **Unit:** mg/L

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | < 30 |
| Microalbuminuria | ≥ 0 yr | All | 30 – 300 |

---

## 6. Thyroid Function

---

### 6.1 Thyroid Stimulating Hormone (TSH)
**Code:** `TSH` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** µIU/mL

| Age Group | Age Range | Gender | Condition | Reference Range |
|-----------|-----------|--------|-----------|-----------------|
| Adult | 18 – 65 yr | All | — | 0.5 – 4.0 |
| Pregnancy — 1st trimester | 18 – 45 yr | F | 1st trimester | 0.1 – 2.5 |
| Pregnancy — 2nd trimester | 18 – 45 yr | F | 2nd trimester | 0.2 – 3.0 |
| Pregnancy — 3rd trimester | 18 – 45 yr | F | 3rd trimester | 0.3 – 3.0 |

> **Dynamic Logic:** If pregnancy flag is set on patient, trimester-specific ranges override the adult range.

---

### 6.2 Free T4 (FT4)
**Code:** `FT4` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/dL

| Age Group | Age Range | Gender | Condition | Reference Range |
|-----------|-----------|--------|-----------|-----------------|
| Adult | ≥ 18 yr | All | — | 0.8 – 1.8 |
| Pregnancy | 18 – 45 yr | F | Pregnancy | 0.8 – 1.5 |

---

### 6.3 Free T3 (FT3)
**Code:** `FT3` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** pg/mL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 2.3 – 4.2 |

---

### 6.4 Total Triiodothyronine — T3 (T3)
**Code:** `T3` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/dL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult | ≥ 18 yr | All | 80 – 200 |

---

### 6.5 Total Thyroxine — T4 (T4)
**Code:** `T4` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 30 min | **Unit:** µg/dL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult | ≥ 18 yr | All | 5.0 – 12.0 |

---

## 7. Reproductive Hormones

---

### 7.1 Estradiol (ESTRADIOL)
**Code:** `ESTRADIOL` | **Price:** ₦280 | **Sample:** Blood | **TAT:** 60 min | **Unit:** pg/mL

| Age Group | Age Range | Gender | Condition (Cycle Phase) | Reference Range |
|-----------|-----------|--------|------------------------|-----------------|
| Follicular | 18 – 50 yr | F | Follicular | 20 – 350 |
| Ovulation | 18 – 50 yr | F | Ovulation | 150 – 750 |
| Luteal | 18 – 50 yr | F | Luteal | 30 – 450 |
| Postmenopause | ≥ 50 yr | F | Postmenopause | < 20 |

---

### 7.2 Progesterone (PROG)
**Code:** `PROG` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/mL

| Age Group | Age Range | Gender | Condition (Cycle Phase) | Reference Range |
|-----------|-----------|--------|------------------------|-----------------|
| Follicular | 18 – 50 yr | F | Follicular | < 0.5 |
| Ovulation | 18 – 50 yr | F | Ovulation | < 0.5 |
| Luteal | 18 – 50 yr | F | Luteal | 3 – 25 |
| Postmenopause | ≥ 50 yr | F | Postmenopause | < 0.4 |

---

### 7.3 Luteinizing Hormone (LH)
**Code:** `LH` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** IU/L

| Age Group | Age Range | Gender | Condition | Reference Range |
|-----------|-----------|--------|-----------|-----------------|
| Female — Follicular | 18 – 50 yr | F | Follicular | 1.4 – 9.9 |
| Female — Ovulation | 18 – 50 yr | F | Ovulation | 6.2 – 17.2 |
| Female — Luteal | 18 – 50 yr | F | Luteal | 1.1 – 9.2 |
| Female — Postmenopause | ≥ 50 yr | F | Postmenopause | 19.3 – 100.6 |
| Male | ≥ 18 yr | M | — | 1.4 – 15.4 |

---

### 7.4 Follicle Stimulating Hormone (FSH)
**Code:** `FSH` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** IU/L

| Age Group | Age Range | Gender | Condition | Reference Range |
|-----------|-----------|--------|-----------|-----------------|
| Female — Follicular | 18 – 50 yr | F | Follicular | 1.4 – 9.9 |
| Female — Ovulation | 18 – 50 yr | F | Ovulation | 6.2 – 17.2 |
| Female — Luteal | 18 – 50 yr | F | Luteal | 1.1 – 9.2 |
| Female — Postmenopause | ≥ 50 yr | F | Postmenopause | 19.3 – 100.6 |
| Male | ≥ 18 yr | M | — | 1.4 – 15.4 |

---

### 7.5 Prolactin (PROLACTIN)
**Code:** `PROLACTIN` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/mL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Female | ≥ 18 yr | F | 3 – 27 |
| Male | ≥ 18 yr | M | 3 – 13 |

---

### 7.6 Beta-HCG (BHCG)
**Code:** `BHCG` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** mIU/mL

| Age Group / Condition | Gender | Range |
|----------------------|--------|-------|
| Non-pregnant | F | < 5 |
| Pregnancy — 3 weeks | F | 5 – 50 |
| Pregnancy — 4 weeks | F | 5 – 426 |
| Pregnancy — 5 weeks | F | 18 – 7,340 |
| Pregnancy — 6 weeks | F | 1,080 – 56,500 |
| Pregnancy — 7–8 weeks | F | 7,650 – 229,000 |

> **Dynamic Logic:** Beta-HCG uses both pregnancy flag and the gestational-week `condition` field for correct interpretation.

---

### 7.7 Testosterone (TESTOSTERONE)
**Code:** `TESTOSTERONE` | **Price:** ₦220 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/dL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Male 20 – 29 yr | 20 – 29 yr | M | 400 – 1,080 |
| Male 30 – 39 yr | 30 – 39 yr | M | 350 – 890 |
| Male 40 – 49 yr | 40 – 49 yr | M | 300 – 750 |
| Male 50 – 59 yr | 50 – 59 yr | M | 250 – 650 |
| Male 60+ yr | ≥ 60 yr | M | 200 – 550 |

> **Note:** Testosterone has a clear age-dependent decline in males.

---

### 7.8 Anti-Müllerian Hormone (AMH)
**Code:** `AMH` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Ovarian Reserve | Age Range | Gender | Range |
|----------------|-----------|--------|-------|
| High | 18 – 35 yr | F | > 3.0 |
| Normal | 18 – 35 yr | F | 1.0 – 3.0 |
| Low | 18 – 35 yr | F | 0.3 – 1.0 |
| Very Low (diminished reserve) | ≥ 35 yr | F | < 0.3 |

---

### 7.9 Cortisol (CORTISOL)
**Code:** `CORTISOL` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** µg/dL

| Collection Time | Gender | Condition | Reference Range |
|----------------|--------|-----------|-----------------|
| AM (7 – 9 am) | All | Morning | 5 – 25 |
| PM (3 – 5 pm) | All | Afternoon | 3 – 16 |

> **Dynamic Logic:** The `condition` field (Morning / Afternoon) is used to apply time-of-day specific ranges.

---

## 8. Tumor Markers

---

### 8.1 Alpha-Fetoprotein (AFP)
**Code:** `AFP` | **Price:** ₦240 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/mL

| Age Group | Gender | Condition | Reference Range |
|-----------|--------|-----------|-----------------|
| Adult | ≥ 18 yr | — | < 10 |
| Pregnancy | 18 – 45 yr | F | Elevated (varies by gestational week) |

---

### 8.2 Prostate Specific Antigen (PSA)
**Code:** `PSA` | **Price:** ₦240 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/mL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| 40 – 49 years | 40 – 49 yr | M | < 2.5 |
| 50 – 59 years | 50 – 59 yr | M | < 3.5 |
| 60 – 69 years | 60 – 69 yr | M | < 4.5 |
| 70 – 79 years | 70 – 79 yr | M | < 6.5 |

> **Dynamic Logic:** PSA upper limits increment with age. Males under 40 have no defined upper limit on record.

---

### 8.3 Free PSA (FPSA)
**Code:** `FPSA` | **Price:** ₦240 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ratio

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| ≥ 18 yr | M | Free/Total PSA Ratio > 0.25 |

> Higher free/total PSA ratio is associated with lower cancer risk.

---

### 8.4 Carcinoembryonic Antigen (CEA)
**Code:** `CEA` | **Price:** ₦240 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/mL

| Age Group | Gender | Condition | Reference Range |
|-----------|--------|-----------|-----------------|
| Non-smoker | ≥ 18 yr | — | < 3.0 |
| Smoker | ≥ 18 yr | — | < 5.0 |

---

### 8.5 Cancer Antigen 125 (CA125)
**Code:** `CA125` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** U/mL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| Normal | ≥ 18 yr | < 35 |

---

## 9. Cardiac Markers

---

### 9.1 Troponin I (TROP)
**Code:** `TROP` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Interpretation Category | Age Range | Gender | Range | Critical High |
|------------------------|-----------|--------|-------|--------------|
| Normal | ≥ 0 yr | All | < 0.04 | **0.4** |
| Elevated | ≥ 0 yr | All | 0.04 – 0.4 | — |
| MI Likely | ≥ 0 yr | All | > 0.4 | — |

---

### 9.2 Troponin T (CTNT)
**Code:** `CTNT` | **Price:** ₦290 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Age Group | Gender | Reference Range | Critical High |
|-----------|--------|-----------------|--------------|
| All ages | All | < 0.01 | **0.1** |

---

### 9.3 B-Type Natriuretic Peptide (BNP)
**Code:** `BNP` | **Price:** ₦370 | **Sample:** Blood | **TAT:** 30 min | **Unit:** pg/mL

| Interpretation Category | Age Range | Gender | Range | Critical High |
|------------------------|-----------|--------|-------|--------------|
| Normal | ≥ 0 yr | All | < 100 | — |
| Heart Failure Possible | ≥ 0 yr | All | 100 – 400 | — |
| Heart Failure Likely | ≥ 0 yr | All | > 400 | **400** |

---

### 9.4 NT-proBNP (NTPRO)
**Code:** `NTPRO` | **Price:** ₦370 | **Sample:** Blood | **TAT:** 30 min | **Unit:** pg/mL

| Age Group | Age Range | Gender | Reference Range | Critical High |
|-----------|-----------|--------|-----------------|--------------|
| < 50 years | 0 – 50 yr | All | < 125 | **450** |
| 50 – 75 years | 50 – 75 yr | All | < 125 | **900** |
| > 75 years | ≥ 75 yr | All | < 125 | **1,800** |

> **Dynamic Logic:** NT-proBNP critical threshold triples in the ≥ 75-year age bracket.

---

### 9.5 Creatine Kinase-MB (CKMB)
**Code:** `CKMB` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | < 5.0 |

---

### 9.6 Myoglobin (MYO)
**Code:** `MYO` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Male | ≥ 18 yr | M | 28 – 72 |
| Female | ≥ 18 yr | F | 25 – 58 |

---

## 10. Coagulation Tests

---

### 10.1 Prothrombin Time (PT)
**Code:** `PT` | **Price:** ₦175 | **Sample:** Blood | **TAT:** 30 min | **Unit:** seconds / INR

| Interpretation | Age Range | Gender | Reference Range |
|---------------|-----------|--------|-----------------|
| Normal (seconds) | ≥ 0 yr | All | 11 – 13.5 seconds |
| Normal (INR) | ≥ 0 yr | All | 0.8 – 1.2 INR |

---

### 10.2 Activated Partial Thromboplastin Time (APTT)
**Code:** `APTT` | **Price:** ₦175 | **Sample:** Blood | **TAT:** 30 min | **Unit:** seconds

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 25 – 35 seconds |

---

### 10.3 Activated Clotting Time (ACT)
**Code:** `ACT` | **Price:** ₦175 | **Sample:** Blood | **TAT:** 30 min | **Unit:** seconds

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 70 – 120 seconds |

---

### 10.4 Fibrinogen (FIB)
**Code:** `FIB` | **Price:** ₦175 | **Sample:** Blood | **TAT:** 30 min | **Unit:** mg/dL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | 200 – 400 |

---

## 11. Inflammation & Infection Markers

---

### 11.1 Interleukin-6 (IL6)
**Code:** `IL6` | **Price:** ₦320 | **Sample:** Blood | **TAT:** 30 min | **Unit:** pg/mL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | < 7.0 |

---

### 11.2 Anti-Streptolysin O (ASO)
**Code:** `ASO` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** IU/mL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | < 200 |

---

### 11.3 Rheumatoid Factor (RF)
**Code:** `RF` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** IU/mL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | < 14 |

---

### 11.4 Anti-CCP (ANTICCP)
**Code:** `ANTICCP` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** U/mL

| Interpretation | Age Range | Gender | Range |
|---------------|-----------|--------|-------|
| Negative | ≥ 0 yr | All | < 20 |
| Positive | ≥ 0 yr | All | ≥ 20 |

---

### 11.5 Total IgE (IGE)
**Code:** `IGE` | **Price:** ₦325 | **Sample:** Blood | **TAT:** 30 min | **Unit:** IU/mL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult | ≥ 18 yr | All | < 100 |

---

### 11.6 H. Pylori IgG Antibody — Finecare (HPYLORI_IA)
**Code:** `HPYLORI_IA` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 60 min | **Unit:** AU/mL

| Interpretation | Age Range | Gender | Range |
|---------------|-----------|--------|-------|
| Negative | ≥ 0 yr | All | < 10 |
| Positive | ≥ 0 yr | All | ≥ 10 |

---

### 11.7 Immunochemical Fecal Occult Blood (IFOB)
**Code:** `IFOB` | **Price:** ₦330 | **Sample:** Stool | **TAT:** 30 min

| Interpretation | Age Range | Gender | Range |
|---------------|-----------|--------|-------|
| Negative | ≥ 0 yr | All | Negative |

---

## 12. Vitamins & Minerals

---

### 12.1 Vitamin D / 25-OH (VITD)
**Code:** `VITD` | **Price:** ₦255 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/mL

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Deficiency | ≥ 0 yr | All | < 20 |
| Insufficiency | ≥ 0 yr | All | 20 – 30 |
| Sufficient | ≥ 0 yr | All | 30 – 100 |
| Optimal | ≥ 0 yr | All | 40 – 60 |

---

### 12.2 Vitamin D — Finecare (VITD_IA)
**Code:** `VITD_IA` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 60 min | **Unit:** ng/mL

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Deficiency | ≥ 0 yr | All | < 20 |
| Insufficiency | ≥ 0 yr | All | 20 – 30 |
| Sufficient | ≥ 0 yr | All | 30 – 100 |

---

### 12.3 Vitamin B12 (VITB12)
**Code:** `VITB12` | **Price:** ₦370 | **Sample:** Blood | **TAT:** 30 min | **Unit:** pg/mL

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | 200 – 900 |
| Deficiency | ≥ 0 yr | All | < 200 |

---

## 13. Renal & Special Markers

---

### 13.1 Ferritin (FERRITIN)
**Code:** `FERRITIN` | **Price:** ₦270 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Male | ≥ 18 yr | M | 24 – 336 |
| Female | ≥ 18 yr | F | 11 – 307 |

---

### 13.2 Cystatin C (CYSC)
**Code:** `CYSC` | **Price:** ₦200 | **Sample:** Blood | **TAT:** 30 min | **Unit:** mg/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult | ≥ 18 yr | All | 0.5 – 1.0 |

---

### 13.3 NGAL — Neutrophil Gelatinase-Associated Lipocalin (NGAL)
**Code:** `NGAL` | **Price:** ₦260 | **Sample:** Blood | **TAT:** 30 min | **Unit:** ng/mL

| Age Group | Gender | Reference Range |
|-----------|--------|-----------------|
| All ages | All | < 150 |

---

### 13.4 Beta-2 Microglobulin (B2MG)
**Code:** `B2MG` | **Price:** ₦305 | **Sample:** Blood | **TAT:** 30 min | **Unit:** mg/L

| Age Group | Age Range | Gender | Reference Range |
|-----------|-----------|--------|-----------------|
| Adult | ≥ 18 yr | All | 0.8 – 2.2 |

---

## 14. Microbiology & Serology

> Tests in this category are qualitative (Positive/Negative). No numeric reference ranges apply.

| Code | Test Name | Price | Sample | TAT | Method |
|------|-----------|-------|--------|-----|--------|
| `HPYLORI` | H. Pylori Stool Antigen | ₦100 | Stool | 60 min | Antigen detection |
| `MALARIA` | Malaria RDT | ₦50 | Blood | 30 min | Rapid antigen test |
| `HIV` | HIV Rapid Test | ₦100 | Blood | 30 min | Antibody rapid test |
| `HBSAG` | Hepatitis B Surface Antigen | ₦50 | Blood | 30 min | Rapid test |
| `HCV` | Hepatitis C Antibody | ₦70 | Blood | 30 min | Antibody rapid test |
| `WIDAL` | Widal Test | ₦80 | Blood | 120 min | Typhoid fever antibody |
| `VDRL` | VDRL | ₦60 | Blood | 120 min | Syphilis screening |
| `GONORRHEA` | Gonorrhea Test | ₦150 | Swab | 60 min | Antigen detection |
| `CHLAMYDIA` | Chlamydia Test | ₦150 | Swab | 60 min | Antigen detection |
| `HSV` | Herpes Simplex Virus | ₦150 | Blood | 60 min | Antibody test |
| `HIVP24` | HIV P24 Antigen | ₦150 | Blood | 30 min | Antigen test (early detection) |
| `STOOLMICRO` | Stool Microscopy | ₦100 | Stool | 120 min | Parasites & ova |
| `BLOODGROUP` | Blood Grouping | ₦70 | Blood | 30 min | ABO + Rh |
| `SICKLE` | Sickle Cell Screen | ₦100 | Blood | 60 min | Solubility test |

---

## 15. Urinalysis

---

### 15.1 Complete Urinalysis (URINE)
**Code:** `URINE` | **Price:** ₦90 | **Sample:** Urine | **TAT:** 60 min  
> Reports all sub-components below.

---

### 15.2 Urine Protein — 24h (UPROTEIN)
**Code:** `UPROTEIN` | **Price:** ₦100 | **Sample:** Urine | **TAT:** 60 min | **Unit:** mg/24h

| Interpretation Category | Age Range | Gender | Range |
|------------------------|-----------|--------|-------|
| Normal | ≥ 0 yr | All | < 150 |
| Microalbuminuria | ≥ 0 yr | All | 30 – 300 |
| Proteinuria | ≥ 0 yr | All | > 300 |

---

### 15.3 Pregnancy Test — Urine (PREGNANCY)
**Code:** `PREGNANCY` | **Price:** ₦100 | **Sample:** Urine | **TAT:** 15 min  
> Qualitative urine HCG. Result: Positive / Negative.

---

### 15.4 Urinalysis Sub-Components *(Analyzer-derived, included in URINE panel)*

All sub-components below have `price: 0` and are reported as part of the `URINE` panel.

#### Physical Examination

| Code | Test | Reference Range | Unit |
|------|------|-----------------|------|
| `URINE-COLOR` | Urine Color | Yellow to Amber | qualitative |
| `URINE-CLARITY` | Urine Clarity | Clear | qualitative |
| `URINE-SG` | Specific Gravity | 1.000 – 1.030 | SG |
| `URINE-PH` | pH | 4.5 – 8.0 | pH |

#### Chemical (Dipstick) Examination

| Code | Test | Reference Range | Unit |
|------|------|-----------------|------|
| `URINE-PROTEIN` | Protein | Negative | qualitative |
| `URINE-GLUCOSE` | Glucose | Negative | qualitative |
| `URINE-KETONES` | Ketones | Negative | qualitative |
| `URINE-BLOOD` | Blood / Hemoglobin | Negative | qualitative |
| `URINE-BILI` | Bilirubin | Negative | qualitative |
| `URINE-URO` | Urobilinogen | 0.1 – 1.0 | mg/dL |
| `URINE-NITRITE` | Nitrite | Negative | qualitative |
| `URINE-LE` | Leukocyte Esterase | Negative | qualitative |

#### Microscopic Examination

| Code | Test | Reference Range | Unit |
|------|------|-----------------|------|
| `URINE-RBC` | RBC | 0 – 3 | /HPF |
| `URINE-WBC` | WBC | 0 – 5 | /HPF |
| `URINE-EPI` | Epithelial Cells | Few | qualitative |
| `URINE-CASTS` | Casts | 0 – 2 hyaline | /LPF |
| `URINE-CRYSTALS` | Crystals | None or Few | qualitative |
| `URINE-BACTERIA` | Bacteria | None | qualitative |

---

## 16. Critical Values Summary

Critical (panic) values trigger immediate notification to clinical staff.

| Code | Test | Critical Low | Critical High | Unit |
|------|------|-------------|--------------|------|
| `HB` | Hemoglobin | **7.0** | **20.0–24.0** | g/dL |
| `HCT` | Hematocrit | **20** | **60–70** | % |
| `WBC` | White Blood Cells | **2.0** | **30.0** | x10⁹/L |
| `PLT` | Platelets | **50** | **1,000** | x10⁹/L |
| `NEUTA` | Neutrophils # | **1.0** | — | x10⁹/L |
| `NA` | Sodium | **120** | **160** | mmol/L |
| `K` | Potassium | **2.5** | **6.5** | mmol/L |
| `CL` | Chloride | **80** | **115** | mmol/L |
| `CA` | Calcium | **7.0** | **13.0** | mg/dL |
| `HCO3` | Bicarbonate | **15** | **40** | mmol/L |
| `CREAT` | Creatinine | — | **5.0** | mg/dL |
| `GLU` | Fasting Blood Glucose | **50** | **500** | mg/dL |
| `RBS` | Random Blood Sugar | **50** | **500** | mg/dL |
| `TBIL` | Total Bilirubin | — | **15.0** | mg/dL |
| `TROP` | Troponin I | — | **0.4** | ng/mL |
| `CTNT` | Troponin T | — | **0.1** | ng/mL |
| `BNP` | BNP | — | **400** | pg/mL |
| `NTPRO` | NT-proBNP | — | **450/900/1800** (age-dependent) | pg/mL |
| `PCT` | Procalcitonin | — | **2.0** | ng/mL |

---

## 17. Test Panels (Bundled Tests)

| Panel Code | Panel Name | Price | Components |
|------------|-----------|-------|------------|
| `FBC` | Full Blood Count | ₦150 | HB, HCT, RBC, WBC, PLT, MCV, MCH, MCHC, RDWCV, RDWSD, MPV, PDW, PLTCT, PLCR, PLCC, NEUTA, LYMPHA, MONOA, EOSA, BASOA |
| `LFT` | Liver Function Test | ₦320 | ALT, AST, ALP, GGT, TBIL, DBIL, TP, ALB |
| `RFT` | Renal Function Test | ₦400 | CREAT, UREA, UA, NA, K, CL, CA, HCO3 |
| `LIPID` | Lipid Profile | ₦320 | CHOL, TG, HDL, LDL, VLDL |
| `ELEC` | Electrolyte Panel | ₦140 | NA, K, CL, CA, HCO3 |
| `URINE` | Urinalysis | ₦90 | COLOR, CLARITY, SG, PH, PROTEIN, GLUCOSE, KETONES, BLOOD, BILI, URO, NITRITE, LE, RBC, WBC, EPI, CASTS, CRYSTALS, BACTERIA |

---

## Appendix A — Range Selection Logic (Pseudocode)

```
function selectRange(test, patient):
  ranges = test.referenceRanges

  // Step 1: Filter by pregnancy
  if patient.isPregnant:
    pregnancyRanges = ranges.filter(r => r.pregnancy == true)
    if pregnancyRanges and patient.trimester:
      match = pregnancyRanges.filter(r => r.condition == patient.trimester)
      if match: return match[0]
    else if pregnancyRanges: return pregnancyRanges[0]

  // Step 2: Filter by condition (cycle phase, time of day)
  if patient.condition:
    conditionRanges = ranges.filter(r => r.condition == patient.condition)
    if conditionRanges: ranges = conditionRanges

  // Step 3: Filter by gender
  genderFiltered = ranges.filter(r => r.gender == patient.gender OR r.gender == 'all')

  // Step 4: Filter by age
  ageFiltered = genderFiltered.filter(r =>
    (r.ageMin == null OR patient.ageYears >= r.ageMin) AND
    (r.ageMax == null OR patient.ageYears <  r.ageMax)
  )

  // Step 5: Choose most specific match (narrowest age range first)
  return ageFiltered.sort_by(r => (r.ageMax - r.ageMin) ASC)[0]
```

---

## Appendix B — Category Overview

| Category | Tests | Notes |
|----------|-------|-------|
| Hematology | HB, HCT, RBC, WBC, PLT, MCV, MCH, MCHC, RDW, RDWCV, RDWSD, MPV, PDW, PLTCT, PLCR, PLCC, NEUTA, LYMPHA, MONOA, EOSA, BASOA, ESR, PT, APTT, ACT, FIB, BLOODGROUP, SICKLE | ZYBIO ZS-2 + Coagulation |
| Chemistry | ALT, AST, ALP, GGT, TBIL, DBIL, TP, ALB, CREAT, UREA, UA, CHOL, TG, HDL, LDL, GLU, RBS, FE, MG, ZN, CO2, TCO2, LDH | ZYBIO EXC-200 |
| Electrolytes | NA, K, CL, CA, HCO3 | CBS-50 |
| Immunoassay | HBA1C, CRP, HSCR, PCT, TSH, FT4, FT3, T3, T4, AFP, PSA, CEA, ESTRADIOL, PROG, LH, FSH, PROLACTIN, BHCG, TESTOSTERONE, VITD, VITD_IA, DDIMER, DDIMER_OS, MAU, AMH, CA125, IL6, FERRITIN, VITB12, CORTISOL, CKMB, MYO, FPSA, CTNT, CYSC, NGAL, B2MG, IFOB, IGE, ASO, RF, ANTICCP, HPYLORI_IA, BNP, NTPRO, TROP | Wondfo Finecare FIA |
| Microbiology | HPYLORI, MALARIA, HIV, HBSAG, HCV, WIDAL, VDRL, GONORRHEA, CHLAMYDIA, HSV, HIVP24, STOOLMICRO | Rapid tests |
| Urinalysis | URINE, UPROTEIN, PREGNANCY + all sub-components | Dipstick + Microscopy |

---

*End of RANGE.md — Generated from live database seed: `backend/src/database/seed-test-catalog.ts`*
