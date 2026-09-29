# Campus Management System

A role-based campus operations platform for students, teachers, parents, and administrators.

This document is the master project brief and implementation guide. It defines the product scope, technical direction, delivery process, data model, security expectations, testing strategy, and prompts to use when implementation begins.

## 1. Product Vision

Create one reliable place for a campus community to manage academic information and communication:

- Students see their routine, attendance, notes, assignments, notices, and payment status.
- Teachers manage classes, attendance, assignments, notes, and announcements.
- Parents receive useful updates about attendance, assignments, notices, and payments.
- Administrators manage users, classes, academic terms, fees, reports, and permissions.

The first release should be a focused campus operations system, not a general social network, learning-management marketplace, or full accounting platform.

## 2. Initial Product Scope

### MVP features

1. Authentication and role-based access
2. Student, teacher, parent, and administrator profiles
3. Campus, academic year, term, class, section, and subject management
4. Student enrollment in a class or section
5. Class routine and timetable
6. Teacher attendance entry
7. Student attendance history
8. Notes and study-material publishing
9. Assignments with due dates and submission status
10. Campus and class notices
11. Fee records and payment-status tracking
12. Parent notifications
13. Basic dashboards for each role
14. Search, filtering, and pagination where data can grow
15. Audit history for sensitive administrative actions

### Explicitly out of scope for the MVP

- Online payment processing
- Payroll
- Full accounting and tax reporting
- Live video classes
- Public student profiles
- Unmoderated chat
- Complex examination management
- Biometric attendance
- Automatic grading by AI
- Multi-campus tenancy unless required by the first real customer

These may be added after the MVP has stable users, permissions, and data quality.

## 3. Recommended Technical Direction

Use a web-first responsive application with a mobile-friendly PWA experience.

### Recommended stack

- Frontend: React, TypeScript, Vite
- Styling: CSS modules or a small local CSS system; keep components accessible and responsive
- Backend: Firebase Authentication, Cloud Firestore, Cloud Functions when server-side work is required
- File storage: Firebase Storage for notes and assignment attachments
- Notifications: Firebase Cloud Messaging and email provider integration later
- Validation: Zod or an equivalent schema validator
- Testing: Vitest for unit tests, React Testing Library for UI tests, Playwright for critical end-to-end flows
- Quality: ESLint, Prettier, TypeScript strict mode, GitHub Actions
- Hosting: Firebase Hosting or Vercel for the frontend; Firebase Functions for backend triggers

### Why this direction

The project needs authentication, role permissions, real-time notices, document uploads, and notifications. Firebase matches those requirements and is already familiar from the existing projects in this portfolio. TypeScript should be used from the beginning because attendance, enrollment, fees, and permissions have many related data shapes.

## 4. User Roles and Permissions

Permissions must be enforced in backend security rules and server-side functions. Hiding a button in the frontend is not security.

### Student

Can:

- View and update allowed profile fields
- View their class routine
- View their attendance
- View published notes and assignments for their enrolled class
- Submit assignment work when enabled
- View notices intended for their class or campus
- View their own fee records and receipts

Cannot:

- Edit attendance
- View another student's private information
- Publish campus-wide notices
- Change fee records

### Teacher

Can:

- View assigned classes and subjects
- Take and correct attendance within an allowed correction window
- Publish notes to assigned classes
- Create and manage assignments for assigned classes
- Publish class notices
- View relevant student academic information
- Add remarks where the school policy allows it

Cannot:

- Modify users outside their assigned scope
- Change payment records
- Read unrelated classes
- Grant permissions

### Parent

Can:

- View linked children only
- View linked children's attendance, routine, assignments, notices, and fee status
- Receive notifications
- Update their own contact information

Cannot:

- View another family's data
- Modify attendance or academic records
- Link a child without an administrator-approved relationship

### Administrator

Can:

- Manage campus settings, academic years, terms, classes, sections, subjects, and routines
- Invite, disable, and assign users
- Enroll students
- Manage fee structures and payment records
- Publish campus-wide notices
- View operational reports
- Review audit logs

Sensitive administrator actions should require a confirmation step and should create an audit event.

## 5. Core Workflows

### Student onboarding

1. Administrator creates or imports a student profile.
2. Administrator assigns the student to a campus, academic year, class, and section.
3. Student receives an invitation or administrator-created login process.
4. Student completes allowed profile fields.
5. Student sees only data connected to the active enrollment.

### Teacher onboarding

1. Administrator creates or invites the teacher.
2. Administrator assigns subjects and classes.
3. Teacher signs in and sees the teacher dashboard.
4. The system restricts attendance, notes, assignments, and notices to assigned classes.

### Parent linking

1. Administrator creates a parent profile.
2. Administrator links the parent to one or more students.
3. The parent signs in and verifies the linked-child list.
4. Notifications are generated only for approved relationships.

### Attendance

1. Teacher selects a class, subject, date, and period.
2. System loads the enrolled students.
3. Teacher marks present, absent, late, or excused.
4. System validates one attendance record per student, class, subject, date, and period.
5. Teacher submits the register.
6. The system records who submitted it and when.
7. Parents and students see the published result according to campus policy.

### Assignment

1. Teacher selects an assigned class and subject.
2. Teacher creates a title, instructions, due date, and optional attachment.
3. Students receive an in-app notification.
4. Student views the assignment and optionally submits work.
5. Teacher sees submission status and adds feedback or marks later.

### Fees

1. Administrator defines a fee type and amount for a term or class.
2. System creates fee records for enrolled students.
3. Administrator records payments or imports them from an approved source.
4. Student and parent see outstanding, paid, overdue, or waived status.
5. Every correction is audited.

## 6. Suggested Information Architecture

### Student navigation

- Dashboard
- Routine
- Attendance
- Notes
- Assignments
- Notices
- Fees
- Profile

### Teacher navigation

- Dashboard
- My Classes
- Attendance
- Notes
- Assignments
- Notices
- Students
- Profile

### Parent navigation

- Dashboard
- My Children
- Attendance
- Routine
- Assignments
- Notices
- Fees
- Notifications
- Profile

### Administrator navigation

- Dashboard
- Users
- Students
- Teachers
- Parents
- Academic Setup
- Classes and Sections
- Subjects
- Routine
- Attendance Reports
- Notes and Assignments
- Notices
- Fees and Payments
- Audit Log
- Settings

## 7. Firestore Data Model

The exact schema can evolve, but all records should have stable IDs, timestamps, and ownership fields where relevant.

```text
campuses/{campusId}
  name
  address
  timezone
  contactEmail
  active
  createdAt
  updatedAt

users/{userId}
  authUid
  role: student | teacher | parent | admin
  campusIds[]
  displayName
  email
  phone
  photoUrl
  status: invited | active | disabled
  createdAt
  updatedAt

academicYears/{academicYearId}
  campusId
  name
  startsOn
  endsOn
  active

terms/{termId}
  campusId
  academicYearId
  name
  startsOn
  endsOn
  active

classes/{classId}
  campusId
  academicYearId
  name
  gradeLevel
  sectionNames[]
  active

subjects/{subjectId}
  campusId
  name
  code
  active

students/{studentId}
  campusId
  userId
  admissionNumber
  fullName
  dateOfBirth
  address
  guardianSummary
  active
  createdAt
  updatedAt

teachers/{teacherId}
  campusId
  userId
  employeeNumber
  fullName
  active

parents/{parentId}
  campusId
  userId
  fullName
  active

parentStudentLinks/{linkId}
  campusId
  parentUserId
  studentId
  relationship
  status: pending | approved | revoked
  createdAt

enrollments/{enrollmentId}
  campusId
  academicYearId
  termId
  studentId
  classId
  section
  status: active | withdrawn | completed

teachingAssignments/{assignmentId}
  campusId
  academicYearId
  teacherId
  classId
  section
  subjectId
  active

routineEntries/{routineEntryId}
  campusId
  academicYearId
  classId
  section
  subjectId
  teacherId
  weekday
  startsAt
  endsAt
  room

attendanceSessions/{sessionId}
  campusId
  academicYearId
  classId
  section
  subjectId
  teacherId
  date
  periodLabel
  status: draft | submitted | corrected
  submittedBy
  submittedAt

attendanceRecords/{recordId}
  sessionId
  campusId
  studentId
  status: present | absent | late | excused
  note
  updatedAt

notes/{noteId}
  campusId
  academicYearId
  classId
  section
  subjectId
  authorId
  title
  body
  attachmentUrls[]
  publishedAt
  status: draft | published | archived

assignments/{assignmentId}
  campusId
  academicYearId
  classId
  section
  subjectId
  teacherId
  title
  instructions
  dueAt
  attachmentUrls[]
  status: draft | published | closed

assignmentSubmissions/{submissionId}
  assignmentId
  campusId
  studentId
  attachmentUrls[]
  textResponse
  submittedAt
  status: submitted | returned | graded
  feedback

notices/{noticeId}
  campusId
  authorId
  audienceType: campus | class | section | role
  audienceIds[]
  title
  body
  priority: normal | important | urgent
  publishedAt
  expiresAt
  status: draft | published | archived

feeStructures/{feeStructureId}
  campusId
  academicYearId
  termId
  classId
  name
  amount
  dueDate
  active

feeRecords/{feeRecordId}
  campusId
  studentId
  feeStructureId
  amountDue
  amountPaid
  balance
  status: unpaid | partial | paid | overdue | waived
  dueDate
  updatedAt

paymentEntries/{paymentEntryId}
  campusId
  studentId
  feeRecordId
  amount
  method: cash | bank_transfer | online | other
  reference
  receivedAt
  receivedBy

notifications/{notificationId}
  recipientUserId
  type
  title
  body
  entityType
  entityId
  readAt
  createdAt

notificationsPreferences/{userId}
  inApp
  email
  push
  attendance
  assignment
  notice
  fee

auditLogs/{auditLogId}
  campusId
  actorUserId
  action
  entityType
  entityId
  beforeSummary
  afterSummary
  createdAt
```

Do not put large file contents directly in Firestore. Store files in Firebase Storage and keep only metadata and download references in Firestore.

## 8. Security and Privacy Requirements

- Never commit service-account keys, private API keys, or production credentials.
- Use separate development and production Firebase projects.
- Store secrets in deployment environment variables.
- Enforce role and campus access in Firestore rules and callable/server functions.
- Deny access by default and add explicit read/write permissions.
- Validate all user-controlled fields on the server boundary.
- Restrict file types and file sizes for uploads.
- Use signed or authenticated file access for private student documents.
- Avoid exposing student admission numbers, phone numbers, addresses, or fee information publicly.
- Keep parent-child links administrator-approved.
- Add an audit record for attendance corrections, fee changes, role changes, and account disabling.
- Define a data-retention policy before production use.
- Provide account disabling and data-correction procedures.
- Use HTTPS only in deployed environments.
- Review Firebase rules with emulator tests before connecting real student data.

## 9. Project Structure

The implementation should eventually follow a structure similar to this:

```text
campus-management-system/
  README.md
  package.json
  package-lock.json
  .env.example
  .gitignore
  firebase.json
  firestore.rules
  firestore.indexes.json
  storage.rules
  vite.config.ts
  tsconfig.json
  src/
    app/
      router.tsx
      providers.tsx
    components/
      layout/
      forms/
      tables/
      feedback/
    features/
      auth/
      dashboard/
      students/
      teachers/
      parents/
      academic/
      routine/
      attendance/
      notes/
      assignments/
      notices/
      fees/
      notifications/
      admin/
    lib/
      firebase.ts
      permissions.ts
      validation.ts
      dates.ts
    types/
      user.ts
      academic.ts
      attendance.ts
      assignment.ts
      fee.ts
    styles/
      tokens.css
      global.css
  functions/
    src/
      notifications.ts
      audit.ts
      fee-generation.ts
  tests/
    unit/
    integration/
    e2e/
  docs/
    architecture.md
    security.md
    operations.md
```

Keep features close to their domain. Avoid putting all Firestore operations in one large utility file.

## 10. Development Process

### Phase 0: Product decisions

Before writing application code, confirm:

- Is this for one campus or multiple campuses?
- What country, timezone, academic calendar, and grading conventions apply?
- Which roles are required for the first pilot?
- Will payments be recorded manually or processed online?
- Which notification channels are available?
- What is the first real workflow that must work end to end?

### Phase 1: Foundation

Deliver:

- React and TypeScript project setup
- Firebase project configuration
- Environment variable handling
- ESLint, formatting, and strict TypeScript
- Base layout and responsive navigation
- Authentication screens
- User profile model
- Role-aware route protection
- Firestore emulator configuration

### Phase 2: Academic setup

Deliver:

- Campus settings
- Academic years and terms
- Classes, sections, subjects
- Student and teacher records
- Enrollments
- Teaching assignments
- Administrator dashboard

### Phase 3: Student and teacher workflows

Deliver:

- Routine management and viewing
- Attendance session creation and submission
- Attendance history
- Notes publishing
- Assignment creation and student submission
- Class notices

### Phase 4: Parent and fee workflows

Deliver:

- Parent-child linking
- Parent dashboard
- Fee structures
- Manual payment records
- Fee status views
- In-app notifications

### Phase 5: Hardening

Deliver:

- Firestore rule tests
- Validation and error handling
- Audit logs
- Accessibility review
- Mobile testing
- Performance checks
- Backup and recovery documentation
- Deployment pipeline
- Production monitoring

### Phase 6: Pilot and feedback

Use a small test group before broad rollout:

- One administrator
- Two teachers
- Several students
- Several parents

Record confusing screens, missing permissions, slow queries, and incorrect notifications. Fix workflow problems before adding new features.

## 11. Definition of Done

A feature is complete only when:

- Its happy path works for the intended role.
- Unauthorized roles cannot read or write its data.
- Loading, empty, validation, success, and error states exist.
- It works on a narrow mobile viewport and desktop viewport.
- Data validation exists at the form and backend boundary.
- Unit or integration tests cover important logic.
- Firestore rule tests cover allowed and denied access.
- Audit requirements are implemented for sensitive actions.
- The README or feature documentation explains setup and behavior.
- The feature has been tested with realistic sample data.

## 12. Testing Checklist

### Authentication

- User can sign in and sign out.
- Disabled users cannot access the application.
- A student cannot open teacher or administrator routes.
- Session loading does not flash protected content.

### Attendance

- Only assigned teachers can edit a register.
- Duplicate records cannot be created.
- Attendance corrections are audited.
- Students and parents can only see permitted records.
- Empty and missing enrollment states are clear.

### Assignments and notes

- Teachers can only publish to assigned classes.
- Students can only see content for active enrollments.
- Upload size and type restrictions work.
- Due dates handle timezone consistently.

### Fees

- Parents can see linked children only.
- Payment totals cannot exceed allowed rules without an explicit correction path.
- Fee changes are audited.
- No fee information is visible through public URLs.

### Notifications

- Notifications are scoped to recipients.
- Repeated triggers do not create uncontrolled duplicates.
- Read/unread state is correct.
- Failed delivery does not lose the underlying notice.

## 13. Performance Guidelines

- Use indexed queries for campus, academic year, class, section, and date filters.
- Paginate large student, notice, payment, and audit lists.
- Avoid loading every student or attendance record on initial dashboard render.
- Cache stable reference data such as subjects and routine entries where appropriate.
- Compress or resize uploaded images.
- Do not subscribe every user to every real-time collection.
- Measure before optimizing.

## 14. Analytics and Operational Metrics

Do not collect unnecessary personal data. Useful product metrics include:

- Active users by role
- Attendance registers completed on time
- Assignment publication and submission counts
- Notice read rate
- Notification delivery failures
- Outstanding fee totals by class
- Most common support problems
- Time required to complete attendance

## 15. Suggested First Release Screens

1. Login
2. Password reset or invitation completion
3. Role-aware dashboard
4. Student list
5. Class and section setup
6. Routine view
7. Attendance register
8. Attendance history
9. Notes list and detail
10. Assignment list, detail, and submission
11. Notice list and detail
12. Parent child selector
13. Fee status and payment history
14. User and role management
15. Audit log

## 16. First Implementation Prompt

Use this prompt when you are ready to start building:

```text
You are the lead engineer for the Campus Management System in this folder.
Read README.md completely before changing anything.

Start with Phase 1 only: project foundation.

Requirements:
- Use React, TypeScript, and Vite.
- Use Firebase Authentication and Firestore, with environment variables only.
- Configure strict TypeScript, ESLint, formatting, and a basic test setup.
- Create the base responsive application shell.
- Implement login, logout, session loading, and protected routes.
- Define the initial User type and roles: student, teacher, parent, admin.
- Add role-aware navigation placeholders without implementing later feature domains.
- Add .env.example and document local setup.
- Do not add real credentials.
- Do not implement attendance, fees, assignments, or notifications yet.
- Keep the change focused and run the available tests and type checks.

Before editing, inspect the folder and state the smallest implementation plan.
After editing, report changed files, validation commands, and any unresolved decisions.
```

## 17. Follow-up Prompts

### Academic setup

```text
Continue from README.md and the existing implementation.
Implement Phase 2: academic setup.

Add campus settings, academic years, terms, classes, sections, subjects, students,
teachers, enrollments, and teaching assignments. Use typed Firestore repositories,
validated forms, loading and error states, and admin-only permissions. Add Firestore
rules and tests for allowed and denied access. Do not implement attendance, fees,
assignments, or notifications yet.
```

### Attendance

```text
Continue from README.md and the existing implementation.
Implement the attendance workflow only.

Add teacher attendance session creation, student records, present/absent/late/excused
statuses, submission, attendance history, correction rules, and audit logging. Teachers
may edit only assigned classes. Students and approved parents may read only permitted
records. Add indexes, validation, Firestore rule tests, and focused UI tests.
```

### Notes and assignments

```text
Continue from README.md and the existing implementation.
Implement notes and assignments for assigned classes.

Teachers can create drafts and publish notes or assignments. Students can view content
for active enrollments and submit assignment work when enabled. Add Firebase Storage
upload restrictions, due-date validation, status handling, and permission tests.
```

### Parents and fees

```text
Continue from README.md and the existing implementation.
Implement parent-child links and manual fee tracking.

Administrators approve links, parents see linked children only, and administrators manage
fee structures and payment records. Add balance calculation, audit events, validation,
permission tests, and responsive dashboard views. Do not add online payment processing.
```

### Production hardening

```text
Review the Campus Management System against README.md.
Do a security and reliability pass without broad unrelated refactoring.

Check authentication, role permissions, Firestore rules, Storage rules, sensitive data
exposure, validation, audit coverage, error states, loading states, accessibility,
mobile layout, query indexes, tests, environment variables, and deployment configuration.
Report findings by severity, fix the highest-risk issues, and rerun focused validation.
```

## 18. Questions to Answer Before Implementation

Record decisions in this README or in `docs/decisions.md`:

1. What is the first campus or pilot group?
2. Is the product single-campus or multi-campus?
3. What exact roles are needed at launch?
4. How are users invited and verified?
5. Who is allowed to correct attendance, and for how long?
6. Are parents allowed to see detailed attendance notes?
7. Will fees be manual records only at first?
8. Which notifications are mandatory and which are optional?
9. What student data must never be stored?
10. What happens when a student changes class or leaves the campus?
11. What is the backup and data deletion policy?
12. Which language should be primary: English, Nepali, or both?

## 19. Project Principle

Build the smallest trustworthy system that solves daily campus work. Correct permissions, understandable workflows, reliable records, and clear documentation matter more than a large feature list.
