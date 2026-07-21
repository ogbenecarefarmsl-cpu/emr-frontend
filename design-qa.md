# Doctor Workbench Design QA

final result: blocked

## Source visual truth

- Reference: `C:\Users\NEWUSER\Documents\emr\emr-frontend\doctor-dashboard-reference.png`
- Previous implementation capture: `C:\Users\NEWUSER\Documents\emr\emr-frontend\doctor-dashboard-implementation.png`
- Target viewport: 1536 x 1024
- Target state: active Mariama Kamara encounter, unsaved SOAP note, critical potassium result

## Full-view comparison evidence

The reference and previous implementation were opened at the same desktop aspect ratio. The previous implementation already drifted from the reference through a shorter command bar, compact patient header, missing row actions, and looser SOAP proportions. Commit `ed1328b` then introduced a more serious regression by switching the 1536px workbench to three columns and exposing a second, duplicate action rail.

The current correction restores the reference hierarchy in source:

- one wide patient/SOAP column and one right-side summary column;
- patient header aligned opposite Vitals Summary;
- SOAP rows with S/O/A/P markers and visible row actions;
- right rail containing Vitals Summary, Critical Lab Alert, Clinical Actions, and Visit & Queue Summary;
- desktop command-bar order of Dashboard, Results, Search, Queue, Alerts, and Accept Next;
- three visible patient tabs, with overflow summarized instead of crowding the command bar;
- reference-height desktop command bar and correctly offset unsaved-changes banner.

## Focused-region comparison evidence

- Command bar: extra Plans, Records, Patients, and profile controls were removed from the desktop row and remain available through the menu where applicable.
- SOAP editor: Add Note and Diagnosis actions were restored; the accidental blank fourth column was removed.
- Workbench grid: the `2xl` three-column override was removed and the duplicate legacy rail remains visually hidden.
- Integrity: vitals validation, numeric lab sorting, edit-order/edit-prescription actions, dirty-navigation guards, and canonical SOAP persistence were retained.

## Verification

| Check | Result |
| --- | --- |
| Reference opened and inspected | Passed |
| Previous implementation opened and inspected | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Production Vite build | Passed |
| Frontend tests | Passed: 1 file, 1 test |
| Local app identity | Passed: Harbour EMR login rendered at `127.0.0.1:5173` |
| Framework overlay | Passed on login surface |
| Console errors | Passed on login surface |
| Signed-in doctor screenshot after correction | Blocked: local backend is unavailable, so doctor login cannot complete |
| Primary doctor-workbench interaction | Blocked by the same unavailable backend |

## Comparison history

1. Earlier implementation capture identified header, density, SOAP-row, and footer drift.
2. The later audit exposed a duplicate third rail and crowded the command bar at the exact 1536px target breakpoint.
3. The source was corrected to the approved two-column composition while retaining functional safeguards.
4. Compiler, build, and automated tests passed after correction.
5. A final signed-in capture could not be produced because the local API was unreachable.

## Remaining blocker

Start or connect the backend, sign into the doctor account, then capture `/doctor` at 1536 x 1024 and compare it with the reference in one combined image. Until that final rendered comparison is available, visual QA cannot honestly be marked passed.
