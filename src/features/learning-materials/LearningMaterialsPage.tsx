import {
  Archive,
  BookOpenText,
  CalendarClock,
  Download,
  FilePlus2,
  LoaderCircle,
  NotebookPen,
  Paperclip,
  Send,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  archiveNote,
  closeAssignment,
  deleteDraft,
  downloadAttachment,
  listAssignmentSubmissions,
  listStudentAccess,
  listStudentAssignments,
  listStudentNotes,
  listStudentSubmissions,
  listTeacherAccess,
  listTeacherAssignments,
  listTeacherNotes,
  saveAssignment,
  saveAssignmentSubmission,
  saveNote,
  uploadLearningAttachment,
  uploadSubmissionAttachment,
} from './repository';
import {
  isAllowedUpload,
  learningSchemas,
  validateAssignmentForPublish,
  type AssignmentSubmission,
  type LearningAssignment,
  type LearningNote,
  type StudentClassAccess,
  type TeachingAccess,
} from './schema';

const initialForm = {
  scopeId: '',
  title: '',
  body: '',
  dueAt: '',
  allowSubmissions: true,
};

function fileLabel(path: string): string {
  return decodeURIComponent(path.split('/').at(-1) ?? 'Attachment').replace(
    /^[-\w]+-/,
    '',
  );
}

function dueInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function LearningMaterialsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const kind = location.pathname === '/assignments' ? 'assignments' : 'notes';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const [teachingAccess, setTeachingAccess] = useState<TeachingAccess[]>([]);
  const [studentAccess, setStudentAccess] = useState<StudentClassAccess[]>([]);
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [teacherSubmissions, setTeacherSubmissions] = useState<
    AssignmentSubmission[]
  >([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const title = kind === 'notes' ? 'Notes' : 'Assignments';

  const reload = useCallback(async () => {
    if (!user || (!isTeacher && !isStudent)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (isTeacher) {
        const access = await listTeacherAccess(user.id);
        setTeachingAccess(access);
        if (kind === 'notes') {
          setNotes(await listTeacherNotes(user.id, access));
          setAssignments([]);
        } else {
          setAssignments(await listTeacherAssignments(user.id, access));
          setNotes([]);
        }
      } else {
        const access = await listStudentAccess(user.id);
        setStudentAccess(access);
        if (kind === 'notes') {
          setNotes(await listStudentNotes(access));
          setAssignments([]);
        } else {
          const [items, work] = await Promise.all([
            listStudentAssignments(access),
            listStudentSubmissions(user.id),
          ]);
          setAssignments(items);
          setSubmissions(work);
          setNotes([]);
        }
      }
    } catch {
      setError(
        'Could not load learning materials. Check your connection and access permissions.',
      );
    } finally {
      setLoading(false);
    }
  }, [isStudent, isTeacher, kind, user]);

  useEffect(() => {
    setForm(initialForm);
    setEditingId(null);
    setSelectedFiles([]);
    setNotice(null);
    void reload();
  }, [reload]);

  const selectedScope = teachingAccess.find(
    (scope) => scope.id === form.scopeId,
  );
  const workByAssignment = useMemo(
    () =>
      new Map(
        submissions.map((submission) => [submission.assignmentId, submission]),
      ),
    [submissions],
  );

  async function handleContentSave(status: 'draft' | 'published') {
    if (!user || !selectedScope) {
      setError('Select one of your assigned class and subject scopes.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);

    const scope = {
      campusId: selectedScope.campusId,
      academicYearId: selectedScope.academicYearId,
      classId: selectedScope.classId,
      sectionId: selectedScope.sectionId,
      subjectId: selectedScope.subjectId,
      teacherId: user.id,
    };
    const publishedAt =
      status === 'published' ? new Date().toISOString() : null;

    try {
      if (kind === 'notes') {
        const existing = notes.find((note) => note.id === editingId);
        const base = {
          ...scope,
          authorId: user.id,
          title: form.title,
          body: form.body,
          attachmentPaths: existing?.attachmentPaths ?? [],
          status:
            existing?.status === 'published'
              ? ('published' as const)
              : ('draft' as const),
          publishedAt: existing?.publishedAt ?? null,
        };
        const checked = learningSchemas.notes.safeParse(base);
        if (!checked.success)
          throw new Error(
            checked.error.issues[0]?.message ?? 'Review the note fields.',
          );
        const id = await saveNote(checked.data, editingId ?? undefined);
        const paths = [...base.attachmentPaths];
        for (const file of selectedFiles) {
          paths.push(
            await uploadLearningAttachment('notes', user.id, id, file),
          );
        }
        const final = learningSchemas.notes.parse({
          ...base,
          attachmentPaths: paths,
          status,
          publishedAt:
            status === 'published'
              ? (existing?.publishedAt ?? publishedAt)
              : null,
        });
        await saveNote(final, id);
        setNotes(await listTeacherNotes(user.id, teachingAccess));
      } else {
        const existing = assignments.find(
          (assignment) => assignment.id === editingId,
        );
        const dueAt = form.dueAt ? new Date(form.dueAt).toISOString() : '';
        const base = {
          ...scope,
          title: form.title,
          instructions: form.body,
          dueAt,
          attachmentPaths: existing?.attachmentPaths ?? [],
          allowSubmissions: form.allowSubmissions,
          status:
            existing?.status === 'published'
              ? ('published' as const)
              : ('draft' as const),
          publishedAt: existing?.publishedAt ?? null,
        };
        const checked = validateAssignmentForPublish(base);
        if (!checked.success)
          throw new Error(
            checked.error.issues[0]?.message ?? 'Review the assignment fields.',
          );
        const id = await saveAssignment(checked.data, editingId ?? undefined);
        const paths = [...base.attachmentPaths];
        for (const file of selectedFiles) {
          paths.push(
            await uploadLearningAttachment('assignments', user.id, id, file),
          );
        }
        const final = validateAssignmentForPublish({
          ...base,
          attachmentPaths: paths,
          status,
          publishedAt:
            status === 'published'
              ? (existing?.publishedAt ?? publishedAt)
              : null,
        });
        if (!final.success)
          throw new Error(
            final.error.issues[0]?.message ?? 'Review the assignment fields.',
          );
        await saveAssignment(final.data, id);
        setAssignments(await listTeacherAssignments(user.id, teachingAccess));
      }
      setNotice(
        status === 'published'
          ? `${title.slice(0, -1)} published.`
          : 'Draft saved.',
      );
      setForm(initialForm);
      setEditingId(null);
      setSelectedFiles([]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `Could not save ${title.toLowerCase()}.`,
      );
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: LearningNote | LearningAssignment) {
    setEditingId(item.id);
    const scope = teachingAccess.find(
      (entry) =>
        entry.academicYearId === item.academicYearId &&
        entry.classId === item.classId &&
        entry.sectionId === item.sectionId &&
        entry.subjectId === item.subjectId,
    );
    setForm({
      scopeId: scope?.id ?? '',
      title: item.title,
      body:
        kind === 'notes'
          ? (item as LearningNote).body
          : (item as LearningAssignment).instructions,
      dueAt:
        kind === 'assignments'
          ? dueInputValue((item as LearningAssignment).dueAt)
          : '',
      allowSubmissions:
        kind === 'assignments'
          ? (item as LearningAssignment).allowSubmissions
          : true,
    });
    setSelectedFiles([]);
    setError(null);
  }

  async function handleStudentSubmission(
    event: FormEvent<HTMLFormElement>,
    assignment: LearningAssignment,
  ) {
    event.preventDefault();
    if (!user) return;
    const membership = studentAccess.find(
      (entry) =>
        entry.academicYearId === assignment.academicYearId &&
        entry.classId === assignment.classId &&
        entry.sectionId === assignment.sectionId,
    );
    if (!membership) {
      setError('This assignment is not linked to an active enrollment.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const paths = [
        ...(workByAssignment.get(assignment.id)?.attachmentPaths ?? []),
      ];
      for (const file of submissionFiles) {
        paths.push(
          await uploadSubmissionAttachment(user.id, assignment.id, file),
        );
      }
      await saveAssignmentSubmission({
        assignmentId: assignment.id,
        campusId: assignment.campusId,
        studentId: membership.studentId,
        studentUserId: user.id,
        attachmentPaths: paths,
        textResponse: submissionText,
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      });
      setSubmissions(await listStudentSubmissions(user.id));
      setSubmissionFiles([]);
      setSubmissionText('');
      setNotice('Assignment work submitted.');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not submit assignment work.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTeacherSubmissionList(assignmentId: string) {
    try {
      setTeacherSubmissions(await listAssignmentSubmissions(assignmentId));
    } catch {
      setError('Could not load submissions for this assignment.');
    }
  }

  function handleFiles(
    files: FileList | null,
    currentCount: number,
    update: (files: File[]) => void,
  ) {
    const next = Array.from(files ?? []);
    if (
      currentCount + next.length > 5 ||
      next.some((file) => !isAllowedUpload(file))
    ) {
      setError(
        'Use up to five PDF, image, Word, or text files, each no larger than 10 MB.',
      );
      return;
    }
    setError(null);
    update(next);
  }

  async function download(path: string) {
    try {
      await downloadAttachment(path, fileLabel(path));
    } catch {
      setError(
        'Could not download this attachment. Check your access and try again.',
      );
    }
  }

  if (!user || (!isTeacher && !isStudent)) {
    return (
      <section className="page-content">
        <p className="eyebrow">LEARNING MATERIALS</p>
        <h1>{title}</h1>
        <p className="page-lede">
          This workspace is available to active teachers and students.
        </p>
      </section>
    );
  }

  return (
    <section className="page-content learning-page">
      <p className="eyebrow">CLASSROOM MATERIALS</p>
      <h1>{title}</h1>
      <p className="page-lede">
        {isTeacher
          ? `Manage ${kind} for your assigned classes and subjects.`
          : `Published ${kind} for your active enrollments.`}
      </p>

      {error && (
        <p className="academic-error learning-feedback" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="learning-notice" role="status">
          {notice}
        </p>
      )}

      {isTeacher && (
        <form
          className="academic-form learning-editor"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="academic-form-heading">
            <div>
              <h2>
                {editingId
                  ? `Edit ${kind === 'notes' ? 'note' : 'assignment'}`
                  : `Create ${kind === 'notes' ? 'note' : 'assignment'}`}
              </h2>
              <p>
                Only your current class and subject assignments are available.
              </p>
            </div>
          </div>
          <div className="academic-fields">
            <div className="academic-field">
              <label htmlFor="learning-scope">Assigned class and subject</label>
              <select
                id="learning-scope"
                value={form.scopeId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scopeId: event.target.value,
                  }))
                }
                required
              >
                <option value="">Select assigned scope</option>
                {teachingAccess.map((scope) => (
                  <option value={scope.id} key={scope.id}>
                    {scope.classId} / {scope.sectionId} · {scope.subjectId}
                  </option>
                ))}
              </select>
            </div>
            <div className="academic-field learning-wide">
              <label htmlFor="learning-title">Title</label>
              <input
                id="learning-title"
                maxLength={160}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                required
              />
            </div>
            {kind === 'assignments' && (
              <div className="academic-field">
                <label htmlFor="assignment-due">Due date and time</label>
                <input
                  id="assignment-due"
                  type="datetime-local"
                  value={form.dueAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      dueAt: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            )}
            <div className="academic-field learning-wide">
              <label htmlFor="learning-body">
                {kind === 'notes' ? 'Note content' : 'Instructions'}
              </label>
              <textarea
                id="learning-body"
                rows={5}
                maxLength={20_000}
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                required
              />
            </div>
            {kind === 'assignments' && (
              <label className="checkbox-label learning-checkbox">
                <input
                  type="checkbox"
                  checked={form.allowSubmissions}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      allowSubmissions: event.target.checked,
                    }))
                  }
                />
                Accept student submissions
              </label>
            )}
            <div className="academic-field learning-wide">
              <label htmlFor="learning-files">
                Attachments (up to 5 files, 10 MB each)
              </label>
              <input
                id="learning-files"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx"
                onChange={(event) =>
                  handleFiles(
                    event.target.files,
                    (kind === 'notes'
                      ? notes.find((item) => item.id === editingId)
                          ?.attachmentPaths.length
                      : assignments.find((item) => item.id === editingId)
                          ?.attachmentPaths.length) ?? 0,
                    setSelectedFiles,
                  )
                }
              />
              {selectedFiles.length > 0 && (
                <span className="field-help">
                  {selectedFiles.map((file) => file.name).join(', ')}
                </span>
              )}
            </div>
          </div>
          {error && (
            <p className="academic-error" role="alert">
              {error}
            </p>
          )}
          <div className="academic-form-actions">
            <button
              className="primary-button academic-submit"
              type="button"
              disabled={saving || !selectedScope}
              onClick={() => void handleContentSave('draft')}
            >
              {saving ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <FilePlus2 size={16} />
              )}
              Save draft
            </button>
            <button
              className="secondary-button learning-publish"
              type="button"
              disabled={saving || !selectedScope}
              onClick={() => void handleContentSave('published')}
            >
              <Send size={15} /> Publish
            </button>
            {editingId && (
              <button
                className="text-command"
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(initialForm);
                  setSelectedFiles([]);
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="academic-state">
          <LoaderCircle size={15} className="spin" /> Loading {kind}...
        </p>
      ) : isTeacher ? (
        <div className="learning-list">
          <div className="academic-list-heading">
            <div>
              <h2>Your {kind}</h2>
              <span>
                {(kind === 'notes' ? notes : assignments).length} records
              </span>
            </div>
          </div>
          {(kind === 'notes' ? notes : assignments).length === 0 ? (
            <p className="academic-state">
              No {kind} yet for your active class assignments.
            </p>
          ) : (
            (kind === 'notes' ? notes : assignments).map((item) => {
              const itemIsNote = 'body' in item;
              const status = item.status;
              const paths = item.attachmentPaths;
              return (
                <article className="learning-row" key={item.id}>
                  <div className="learning-row-main">
                    <div className="learning-row-title">
                      <strong>{item.title}</strong>
                      <span className={`learning-status status-${status}`}>
                        {status}
                      </span>
                    </div>
                    <p>
                      {item.classId} / {item.sectionId} · {item.subjectId}
                    </p>
                    {itemIsNote ? (
                      <p className="learning-excerpt">{item.body}</p>
                    ) : (
                      <p className="learning-excerpt">
                        Due{' '}
                        {new Date(
                          (item as LearningAssignment).dueAt,
                        ).toLocaleString()}
                      </p>
                    )}
                    {paths.length > 0 && (
                      <div className="learning-attachments">
                        {paths.map((path) => (
                          <button
                            className="text-command"
                            type="button"
                            key={path}
                            onClick={() => void download(path)}
                          >
                            <Download size={14} />
                            {fileLabel(path)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="learning-actions">
                    <button
                      className="text-command"
                      type="button"
                      onClick={() => beginEdit(item)}
                      aria-label={`Edit ${item.title}`}
                    >
                      Edit
                    </button>
                    {kind === 'notes' && status !== 'archived' && (
                      <button
                        className="icon-command"
                        type="button"
                        title="Archive note"
                        aria-label="Archive note"
                        onClick={async () => {
                          try {
                            await archiveNote(item.id);
                            await reload();
                          } catch {
                            setError('Could not archive this note.');
                          }
                        }}
                      >
                        <Archive size={15} />
                      </button>
                    )}
                    {kind === 'assignments' && status === 'published' && (
                      <button
                        className="text-command"
                        type="button"
                        onClick={async () => {
                          try {
                            await closeAssignment(item.id);
                            await reload();
                          } catch {
                            setError('Could not close this assignment.');
                          }
                        }}
                      >
                        Close
                      </button>
                    )}
                    {status === 'draft' && (
                      <button
                        className="icon-command danger-command"
                        type="button"
                        title="Delete draft"
                        aria-label="Delete draft"
                        onClick={async () => {
                          try {
                            await deleteDraft(kind, item.id);
                            await reload();
                          } catch {
                            setError('Could not delete this draft.');
                          }
                        }}
                      >
                        <Archive size={15} />
                      </button>
                    )}
                    {!itemIsNote && (
                      <button
                        className="text-command"
                        type="button"
                        onClick={() =>
                          void handleTeacherSubmissionList(item.id)
                        }
                      >
                        Submissions
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
          {teacherSubmissions.length > 0 && (
            <div className="learning-submissions">
              <h3>Student submissions</h3>
              {teacherSubmissions.map((work) => (
                <div className="learning-submission-row" key={work.id}>
                  <p>
                    {work.studentId} · {work.status} ·{' '}
                    {new Date(work.submittedAt).toLocaleString()}
                  </p>
                  {work.textResponse && <p>{work.textResponse}</p>}
                  {work.attachmentPaths.map((path) => (
                    <button
                      className="text-command"
                      type="button"
                      key={path}
                      onClick={() => void download(path)}
                    >
                      <Download size={14} />
                      {fileLabel(path)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="learning-list">
          <div className="academic-list-heading">
            <div>
              <h2>Published {kind}</h2>
              <span>
                {(kind === 'notes' ? notes : assignments).length} records
              </span>
            </div>
          </div>
          {(kind === 'notes' ? notes : assignments).length === 0 ? (
            <p className="academic-state">
              No published {kind} for your active enrollments.
            </p>
          ) : (
            (kind === 'notes' ? notes : assignments).map((item) => {
              const itemIsNote = 'body' in item;
              const assignment = itemIsNote
                ? null
                : (item as LearningAssignment);
              const currentWork = assignment
                ? workByAssignment.get(assignment.id)
                : undefined;
              const canSubmit = Boolean(
                assignment &&
                assignment.allowSubmissions &&
                assignment.status === 'published' &&
                new Date(assignment.dueAt).getTime() > Date.now(),
              );
              return (
                <article
                  className="learning-row student-learning-row"
                  key={item.id}
                >
                  <div className="learning-row-main">
                    <div className="learning-row-title">
                      <strong>{item.title}</strong>
                      {assignment && (
                        <span
                          className={`learning-status status-${assignment.status}`}
                        >
                          {assignment.status}
                        </span>
                      )}
                    </div>
                    <p>
                      {item.classId} / {item.sectionId} · {item.subjectId}
                    </p>
                    <p className="learning-excerpt">
                      {itemIsNote
                        ? (item as LearningNote).body
                        : assignment?.instructions}
                    </p>
                    {assignment && (
                      <p className="learning-due">
                        <CalendarClock size={14} /> Due{' '}
                        {new Date(assignment.dueAt).toLocaleString()}
                      </p>
                    )}
                    {item.attachmentPaths.length > 0 && (
                      <div className="learning-attachments">
                        {item.attachmentPaths.map((path) => (
                          <button
                            className="text-command"
                            type="button"
                            key={path}
                            onClick={() => void download(path)}
                          >
                            <Download size={14} />
                            {fileLabel(path)}
                          </button>
                        ))}
                      </div>
                    )}
                    {assignment && canSubmit && (
                      <form
                        className="submission-form"
                        onSubmit={(event) =>
                          void handleStudentSubmission(event, assignment)
                        }
                      >
                        <label htmlFor={`response-${assignment.id}`}>
                          Your response
                        </label>
                        <textarea
                          id={`response-${assignment.id}`}
                          rows={3}
                          maxLength={10_000}
                          value={submissionText}
                          onChange={(event) =>
                            setSubmissionText(event.target.value)
                          }
                          placeholder="Write a response or attach your work"
                        />
                        <label className="submission-file">
                          <Paperclip size={14} /> Attach work
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.txt,.doc,.docx"
                            onChange={(event) =>
                              handleFiles(
                                event.target.files,
                                currentWork?.attachmentPaths.length ?? 0,
                                setSubmissionFiles,
                              )
                            }
                          />
                        </label>
                        {submissionFiles.length > 0 && (
                          <span className="field-help">
                            {submissionFiles
                              .map((file) => file.name)
                              .join(', ')}
                          </span>
                        )}
                        {currentWork?.attachmentPaths.map((path) => (
                          <button
                            className="text-command"
                            type="button"
                            key={path}
                            onClick={() => void download(path)}
                          >
                            <Download size={14} />
                            {fileLabel(path)}
                          </button>
                        ))}
                        <button
                          className="primary-button academic-submit"
                          type="submit"
                          disabled={saving}
                        >
                          <Send size={15} />
                          {saving
                            ? 'Submitting...'
                            : currentWork
                              ? 'Update submission'
                              : 'Submit work'}
                        </button>
                      </form>
                    )}
                    {assignment && !canSubmit && (
                      <p className="learning-submitted">
                        {currentWork
                          ? `Submitted ${new Date(currentWork.submittedAt).toLocaleString()}`
                          : assignment.status === 'closed'
                            ? 'Submissions are closed.'
                            : assignment.allowSubmissions
                              ? 'The due date has passed.'
                              : 'Submissions are not enabled.'}
                      </p>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {isTeacher && teachingAccess.length === 0 && !loading && (
        <p className="academic-state">
          No active teaching assignments are linked to this account.
        </p>
      )}
      {isStudent && studentAccess.length === 0 && !loading && (
        <p className="academic-state">
          No active enrollment is linked to this account.
        </p>
      )}
      {isTeacher && kind === 'notes' && notes.length === 0 && !loading && (
        <p className="learning-hint">
          <NotebookPen size={15} /> Create a draft or publish class notes above.
        </p>
      )}
      {isStudent && kind === 'notes' && notes.length > 0 && (
        <span className="learning-hint">
          <BookOpenText size={15} /> Notes shown here match your active class
          enrollments.
        </span>
      )}
    </section>
  );
}
