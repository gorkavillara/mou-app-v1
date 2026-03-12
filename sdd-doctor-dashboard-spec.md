# Specification: Doctor Dashboard Enhancement

## Status: draft

## Executive Summary

This specification defines requirements for enhancing the existing doctor dashboard in the Mou hand rehabilitation platform. The enhancement adds real-time session visualization, advanced patient metrics, alert management, and task management capabilities to support doctors in monitoring and treating patients undergoing hand rehabilitation.

## Detailed Report

### 1. Affected Areas

Based on the proposal's affected areas, this change impacts:
- **Frontend**: Doctor dashboard (`/doctor`), patient list (`/doctor/pacientes`), patient detail (`/doctor/pacientes/[id]`)
- **Data Layer**: Patient metrics, session data, alerts, tasks

### 2. Requirements

#### 2.1 Functional Requirements

##### Requirement: Dashboard Overview Metrics

The system SHALL display a dashboard overview with the following metrics:
- Total number of assigned patients
- Total sessions count for current period
- Average adherence percentage across all patients
- Active alerts count

**Scenario: Dashboard loads successfully**
- GIVEN a doctor is authenticated and has assigned patients
- WHEN the doctor navigates to `/doctor`
- THEN the dashboard SHALL display patient count, session count, and adherence percentage
- AND alerts count SHALL be displayed if any exist

**Scenario: No patients assigned**
- GIVEN a doctor has no assigned patients
- WHEN the doctor navigates to `/doctor`
- THEN the dashboard SHALL display zero values for all metrics
- AND a message SHALL indicate no patients are assigned

---

##### Requirement: Patient List

The system SHALL display a list of assigned patients with key information:
- Patient name and ID
- Diagnosis
- IFRM score
- Adherence percentage
- Last session date

**Scenario: View patient list**
- GIVEN a doctor is authenticated
- WHEN the doctor navigates to `/doctor/pacientes`
- THEN a list of all assigned patients SHALL be displayed
- AND each patient entry SHALL show name, diagnosis, IFRM, and adherence

**Scenario: Navigate to patient detail**
- GIVEN a doctor views the patient list
- WHEN the doctor clicks on a patient card
- THEN the doctor SHALL be navigated to `/doctor/pacientes/{patientId}`
- AND the patient detail page SHALL load

---

##### Requirement: Patient Detail View

The system SHALL display comprehensive patient information including:
- Patient personal information (name, ID, diagnosis, insurance, phone)
- Current IFRM score
- Adherence percentage
- Pain level
- Session history with visualization
- Notes list
- Tasks list

**Scenario: View patient details**
- GIVEN a doctor is viewing a specific patient
- WHEN the patient ID is valid
- THEN all patient information SHALL be displayed
- AND session history SHALL be shown in a chart format

**Scenario: Patient not found**
- GIVEN a doctor requests a patient that does not exist
- WHEN the patient ID is not found in the database
- THEN an error message SHALL be displayed indicating patient not found

---

##### Requirement: Session Visualization

The system SHALL display real-time hand tracking visualization during sessions:
- Video feed from webcam
- Hand landmark overlay
- Finger angle indicators
- Repetition counter

**Scenario: Session playback available**
- GIVEN a session has recorded data
- WHEN the doctor selects a session to view
- THEN the system SHALL display hand landmarks overlaid on video
- AND metrics SHALL be shown (flexion angles, repetitions)

**Scenario: No session data**
- GIVEN a patient has no sessions
- WHEN viewing patient detail
- THEN a message SHALL indicate no sessions are recorded

---

##### Requirement: Alert Management

The system SHALL display and manage patient alerts:
- List of critical and warning alerts
- Alert type (CRITICAL, WARNING)
- Alert title and description
- Timestamp

**Scenario: View alerts**
- GIVEN a doctor has patients with active alerts
- WHEN the doctor views the dashboard
- THEN alerts SHALL be displayed sorted by priority (critical first)
- AND each alert SHALL show type, title, and description

**Scenario: No alerts**
- GIVEN no patients have active alerts
- WHEN the doctor views the dashboard
- THEN a message SHALL indicate no alerts

---

##### Requirement: Task Management

The system SHALL display and allow management of tasks:
- Task title and description
- Due date
- Status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
- Priority (LOW, MEDIUM, HIGH, URGENT)

**Scenario: View patient tasks**
- GIVEN a doctor views a patient detail
- WHEN tasks exist for that patient
- THEN tasks SHALL be displayed with title, status, and due date

**Scenario: Create task**
- GIVEN a doctor is viewing patient detail
- WHEN the doctor creates a new task
- THEN the task SHALL be saved to the database
- AND the task list SHALL be updated

---

##### Requirement: Session Notes

The system SHALL display and allow creation of session notes:
- Note content (markdown supported)
- Creation timestamp
- Privacy flag (isPrivate)

**Scenario: View notes**
- GIVEN a doctor views a patient detail
- WHEN notes exist for that patient
- THEN notes SHALL be displayed in chronological order

**Scenario: Create note**
- GIVEN a doctor is viewing patient detail
- WHEN the doctor creates a new note
- THEN the note SHALL be saved to the database
- AND the note list SHALL be updated

---

#### 2.2 Non-Functional Requirements

##### Performance Requirement

The system SHALL load dashboard data within 3 seconds under normal network conditions.

##### Availability Requirement

The system SHALL display cached data when network is unavailable.

##### Accessibility Requirement

All interactive elements SHALL be keyboard accessible.

##### Security Requirement

The system SHALL only display data for patients assigned to the authenticated doctor.

---

### 3. Test Cases / Verification Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| TC01 | Doctor logs in and views dashboard | Dashboard displays patient count, sessions, adherence |
| TC02 | Doctor views patient list | All assigned patients displayed with metrics |
| TC03 | Doctor clicks patient card | Navigation to patient detail page |
| TC04 | Patient detail loads | All patient info, sessions, notes, tasks displayed |
| TC05 | Invalid patient ID accessed | Error message displayed |
| TC06 | Doctor views alerts | Alerts displayed sorted by priority |
| TC07 | No alerts exist | "No alerts" message displayed |
| TC08 | Doctor creates task | Task saved and displayed in list |
| TC09 | Doctor creates note | Note saved and displayed in list |
| TC10 | No sessions for patient | "No sessions" message displayed |

---

### 4. Acceptance Criteria

The following criteria MUST be satisfied for the change to be considered complete:

1. Dashboard at `/doctor` displays:
   - Patient count
   - Session count
   - Adherence percentage
   - Alerts count

2. Patient list at `/doctor/pacientes` displays:
   - All assigned patients
   - Each patient shows name, diagnosis, IFRM, adherence

3. Patient detail at `/doctor/pacientes/{id}` displays:
   - Patient info (name, diagnosis, insurance, phone)
   - IFRM, adherence, pain level
   - Session chart
   - Notes list
   - Tasks list

4. All pages follow existing design patterns:
   - Tailwind CSS
   - Blue (#007AFF) primary color
   - White cards with gray borders
   - iOS-inspired rounded corners

5. Data fetched from Supabase based on authenticated doctor's assignments

6. All text in Spanish

---

## Artifacts

- `/src/app/doctor/page.tsx` - Main dashboard
- `/src/app/doctor/pacientes/page.tsx` - Patient list
- `/src/app/doctor/pacientes/[id]/page.tsx` - Patient detail

## Next Recommended

After this specification is approved:
1. Proceed to sdd-design for technical design
2. Create implementation tasks with sdd-tasks

## Risks

- **Risk 1**: Supabase connection issues may affect data fetching
- **Risk 2**: Real-time session visualization requires significant development effort
- **Risk 3**: Video storage and streaming infrastructure not yet implemented
