import { z } from 'zod';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import {
  academicCollections,
  academicSchemas,
  type AcademicCollection,
  type AcademicRecord,
  type AcademicRecordInput,
} from './schema';
import {
  createAcademicRecord,
  deleteAcademicRecord,
  listAcademicRecords,
  rebuildAcademicAccessIndexes,
  updateAcademicRecord,
} from './repository';

type FieldKind = 'text' | 'email' | 'date' | 'number' | 'select' | 'checkbox';
interface FieldDefinition {
  name: string;
  label: string;
  kind?: FieldKind;
  required?: boolean;
  source?: AcademicCollection;
  choices?: { label: string; value: string }[];
  help?: string;
}
interface EntityDefinition {
  label: string;
  singular: string;
  description: string;
  primaryField: string;
  fields: FieldDefinition[];
}

const entityDefinitions: Record<AcademicCollection, EntityDefinition> = {
  campuses: {
    label: 'Campuses',
    singular: 'campus',
    primaryField: 'name',
    description: 'Manage campus contact details and operational settings.',
    fields: [
      { name: 'name', label: 'Campus name', required: true },
      { name: 'address', label: 'Address' },
      {
        name: 'timezone',
        label: 'Timezone',
        required: true,
        help: 'Use an IANA timezone, such as Asia/Kathmandu.',
      },
      { name: 'contactEmail', label: 'Contact email', kind: 'email' },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  academicYears: {
    label: 'Academic Years',
    singular: 'academic year',
    primaryField: 'name',
    description: 'Set the academic calendar range for a campus.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'name',
        label: 'Year name',
        required: true,
        help: 'For example, 2026-2027.',
      },
      { name: 'startsOn', label: 'Starts on', kind: 'date', required: true },
      { name: 'endsOn', label: 'Ends on', kind: 'date', required: true },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  terms: {
    label: 'Terms',
    singular: 'term',
    primaryField: 'name',
    description: 'Define terms within an academic year.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'academicYearId',
        label: 'Academic year',
        kind: 'select',
        source: 'academicYears',
        required: true,
      },
      { name: 'name', label: 'Term name', required: true },
      { name: 'startsOn', label: 'Starts on', kind: 'date', required: true },
      { name: 'endsOn', label: 'Ends on', kind: 'date', required: true },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  classes: {
    label: 'Classes',
    singular: 'class',
    primaryField: 'name',
    description:
      'Create classes for a campus and academic year. Sections are managed separately.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'academicYearId',
        label: 'Academic year',
        kind: 'select',
        source: 'academicYears',
        required: true,
      },
      { name: 'name', label: 'Class name', required: true },
      {
        name: 'gradeLevel',
        label: 'Grade level',
        kind: 'number',
        required: true,
      },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  sections: {
    label: 'Sections',
    singular: 'section',
    primaryField: 'name',
    description: 'Add named sections to an existing class.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'classId',
        label: 'Class',
        kind: 'select',
        source: 'classes',
        required: true,
      },
      { name: 'name', label: 'Section name', required: true },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  subjects: {
    label: 'Subjects',
    singular: 'subject',
    primaryField: 'name',
    description: 'Maintain the subject catalogue for each campus.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      { name: 'name', label: 'Subject name', required: true },
      { name: 'code', label: 'Subject code', required: true },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  students: {
    label: 'Students',
    singular: 'student',
    primaryField: 'fullName',
    description:
      'Create and maintain student records. Link an existing Firebase Auth UID; account invitations remain an administrator setup task.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'userId',
        label: 'Firebase Auth UID',
        required: true,
        help: 'Create the login in Firebase Authentication first, then enter its UID.',
      },
      { name: 'admissionNumber', label: 'Admission number', required: true },
      { name: 'fullName', label: 'Full name', required: true },
      { name: 'dateOfBirth', label: 'Date of birth', kind: 'date' },
      { name: 'address', label: 'Address' },
      { name: 'guardianSummary', label: 'Guardian summary' },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  teachers: {
    label: 'Teachers',
    singular: 'teacher',
    primaryField: 'fullName',
    description:
      'Create and maintain teacher records linked to existing Firebase accounts.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'userId',
        label: 'Firebase Auth UID',
        required: true,
        help: 'Create the login in Firebase Authentication first, then enter its UID.',
      },
      { name: 'employeeNumber', label: 'Employee number', required: true },
      { name: 'fullName', label: 'Full name', required: true },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
  enrollments: {
    label: 'Enrollments',
    singular: 'enrollment',
    primaryField: 'studentId',
    description: 'Place a student in a class section for a term.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'academicYearId',
        label: 'Academic year',
        kind: 'select',
        source: 'academicYears',
        required: true,
      },
      {
        name: 'termId',
        label: 'Term',
        kind: 'select',
        source: 'terms',
        required: true,
      },
      {
        name: 'studentId',
        label: 'Student',
        kind: 'select',
        source: 'students',
        required: true,
      },
      {
        name: 'classId',
        label: 'Class',
        kind: 'select',
        source: 'classes',
        required: true,
      },
      {
        name: 'sectionId',
        label: 'Section',
        kind: 'select',
        source: 'sections',
        required: true,
      },
      {
        name: 'status',
        label: 'Status',
        kind: 'select',
        required: true,
        choices: [
          { label: 'Active', value: 'active' },
          { label: 'Withdrawn', value: 'withdrawn' },
          { label: 'Completed', value: 'completed' },
        ],
      },
    ],
  },
  teachingAssignments: {
    label: 'Teaching Assignments',
    singular: 'teaching assignment',
    primaryField: 'teacherId',
    description:
      'Assign teachers to subjects, classes, and sections for an academic year.',
    fields: [
      {
        name: 'campusId',
        label: 'Campus',
        kind: 'select',
        source: 'campuses',
        required: true,
      },
      {
        name: 'academicYearId',
        label: 'Academic year',
        kind: 'select',
        source: 'academicYears',
        required: true,
      },
      {
        name: 'teacherId',
        label: 'Teacher',
        kind: 'select',
        source: 'teachers',
        required: true,
      },
      {
        name: 'classId',
        label: 'Class',
        kind: 'select',
        source: 'classes',
        required: true,
      },
      {
        name: 'sectionId',
        label: 'Section',
        kind: 'select',
        source: 'sections',
        required: true,
      },
      {
        name: 'subjectId',
        label: 'Subject',
        kind: 'select',
        source: 'subjects',
        required: true,
      },
      { name: 'active', label: 'Active', kind: 'checkbox' },
    ],
  },
};

type FormValues = Record<string, string | boolean>;
type RecordsByCollection = Partial<
  Record<AcademicCollection, AcademicRecord<AcademicCollection>[]>
>;

function blankValues(definition: EntityDefinition): FormValues {
  return Object.fromEntries(
    definition.fields.map((field) => [
      field.name,
      field.kind === 'checkbox'
        ? true
        : field.kind === 'select' && field.choices?.[0]?.value
          ? field.choices[0].value
          : '',
    ]),
  );
}

function recordTitle(record: AcademicRecord<AcademicCollection>): string {
  const data = record as unknown as Record<string, unknown>;
  for (const key of [
    'name',
    'fullName',
    'admissionNumber',
    'employeeNumber',
    'code',
  ]) {
    if (typeof data[key] === 'string' && data[key] !== '')
      return data[key] as string;
  }
  return record.id;
}

function inputValues(
  record: AcademicRecord<AcademicCollection>,
  definition: EntityDefinition,
): FormValues {
  const data = record as unknown as Record<string, unknown>;
  return Object.fromEntries(
    definition.fields
      .map((field) => {
        const value = data[field.name];
        return [
          field.name,
          typeof value === 'boolean' ||
          typeof value === 'string' ||
          typeof value === 'number'
            ? String(value)
            : '',
        ];
      })
      .map(([key, value]) => {
        const field = definition.fields.find((item) => item.name === key);
        return [key, field?.kind === 'checkbox' ? value === 'true' : value];
      }),
  );
}

function formatValue(
  field: FieldDefinition,
  value: unknown,
  records: RecordsByCollection,
): string {
  if (typeof value === 'boolean') return value ? 'Active' : 'Inactive';
  if (field.choices)
    return (
      field.choices.find((choice) => choice.value === value)?.label ??
      String(value ?? '')
    );
  if (field.source && typeof value === 'string') {
    return records[field.source]?.find((record) => record.id === value)
      ? recordTitle(
          records[field.source]!.find((record) => record.id === value)!,
        )
      : 'Missing linked record';
  }
  return value == null || value === '' ? '—' : String(value);
}

export function AcademicSetupPage() {
  const { entity: routeEntity } = useParams();
  const isValidEntity = academicCollections.includes(
    routeEntity as AcademicCollection,
  );
  const entity = (
    isValidEntity ? routeEntity : 'campuses'
  ) as AcademicCollection;
  const definition = entityDefinitions[entity];
  const relatedCollections = useMemo(
    () =>
      Array.from(
        new Set([
          entity,
          ...definition.fields.flatMap((field) =>
            field.source ? [field.source] : [],
          ),
        ]),
      ),
    [entity, definition],
  );
  const [records, setRecords] = useState<AcademicRecord<AcademicCollection>[]>(
    [],
  );
  const [relatedRecords, setRelatedRecords] = useState<RecordsByCollection>({});
  const [values, setValues] = useState<FormValues>(() =>
    blankValues(definition),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const accessIndexesRebuilt = useRef(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!accessIndexesRebuilt.current) {
        await rebuildAcademicAccessIndexes();
        accessIndexesRebuilt.current = true;
      }
      const loaded = await Promise.all(
        relatedCollections.map(
          async (name) => [name, await listAcademicRecords(name)] as const,
        ),
      );
      const byCollection = Object.fromEntries(loaded) as RecordsByCollection;
      setRelatedRecords(byCollection);
      setRecords(byCollection[entity] ?? []);
    } catch {
      setError(
        'Could not load academic records. Check your connection and administrator access.',
      );
    } finally {
      setLoading(false);
    }
  }, [entity, relatedCollections]);

  useEffect(() => {
    setValues(blankValues(definition));
    setEditingId(null);
    void loadRecords();
  }, [definition, entity, loadRecords]);

  function resetForm() {
    setValues(blankValues(definition));
    setEditingId(null);
    setFieldErrors({});
  }

  function beginEdit(record: AcademicRecord<AcademicCollection>) {
    setValues(inputValues(record, definition));
    setEditingId(record.id);
    setFieldErrors({});
    document
      .getElementById('academic-record-form')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const payload = Object.fromEntries(
      definition.fields.map((field) => {
        const value = values[field.name];
        return [field.name, field.kind === 'number' ? Number(value) : value];
      }),
    );
    const schema = academicSchemas[entity] as z.ZodType;
    const validation = schema.safeParse(payload);
    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      setFieldErrors(
        Object.fromEntries(
          Object.entries(errors).map(([key, messages]) => [
            key,
            messages?.[0] ?? 'Invalid value.',
          ]),
        ),
      );
      setSaving(false);
      return;
    }

    try {
      const parsed = validation.data as AcademicRecordInput<AcademicCollection>;
      if (editingId) {
        await updateAcademicRecord<AcademicCollection>(
          entity,
          editingId,
          parsed,
        );
      } else {
        await createAcademicRecord<AcademicCollection>(entity, parsed);
      }
      resetForm();
      await loadRecords();
    } catch (caught) {
      setError(
        caught instanceof z.ZodError
          ? (caught.issues[0]?.message ?? 'Check the form values.')
          : 'Could not save this record. Check required linked records and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: AcademicRecord<AcademicCollection>) {
    if (
      !window.confirm(
        `Delete ${definition.singular} “${recordTitle(record)}”? This cannot be undone.`,
      )
    )
      return;
    setError(null);
    try {
      await deleteAcademicRecord(entity, record.id);
      if (editingId === record.id) resetForm();
      await loadRecords();
    } catch {
      setError(
        'Could not delete this record. Other records may still refer to it.',
      );
    }
  }

  if (!isValidEntity) {
    return (
      <section className="page-content">
        <h1>Academic section not found</h1>
        <Link to="/academic/campuses">Open academic setup</Link>
      </section>
    );
  }

  const tableFields = definition.fields
    .filter((field) => field.name !== definition.primaryField)
    .slice(0, 3);

  return (
    <section className="page-content academic-page">
      <p className="eyebrow">ACADEMIC SETUP</p>
      <h1>{definition.label}</h1>
      <p className="page-lede">{definition.description}</p>

      <nav className="academic-tabs" aria-label="Academic setup sections">
        {academicCollections.map((name) => (
          <Link
            key={name}
            to={`/academic/${name}`}
            aria-current={name === entity ? 'page' : undefined}
          >
            {entityDefinitions[name].label}
          </Link>
        ))}
      </nav>

      <form
        id="academic-record-form"
        className="academic-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="academic-form-heading">
          <div>
            <h2>
              {editingId
                ? `Edit ${definition.singular}`
                : `Add ${definition.singular}`}
            </h2>
            <p>
              {editingId
                ? 'Update this record.'
                : 'Required fields are marked with an asterisk.'}
            </p>
          </div>
          {editingId && (
            <button
              className="icon-command"
              type="button"
              onClick={resetForm}
              aria-label="Cancel edit"
              title="Cancel edit"
            >
              <X size={17} />
            </button>
          )}
        </div>
        <div className="academic-fields">
          {definition.fields.map((field) => {
            const fieldId = `academic-${field.name}`;
            const value = values[field.name];
            const options = field.source
              ? (relatedRecords[field.source] ?? [])
              : [];
            return (
              <div
                className={`academic-field${field.kind === 'checkbox' ? ' checkbox-field' : ''}`}
                key={field.name}
              >
                {field.kind === 'checkbox' ? (
                  <label className="checkbox-label" htmlFor={fieldId}>
                    <input
                      id={fieldId}
                      type="checkbox"
                      checked={value === true}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.name]: event.target.checked,
                        }))
                      }
                    />
                    {field.label}
                  </label>
                ) : (
                  <>
                    <label htmlFor={fieldId}>
                      {field.label}
                      {field.required && <span aria-hidden="true"> *</span>}
                    </label>
                    {field.kind === 'select' ? (
                      <select
                        id={fieldId}
                        required={field.required}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      >
                        <option value="">
                          Select {field.label.toLowerCase()}
                        </option>
                        {field.choices?.map((choice) => (
                          <option value={choice.value} key={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                        {options.map((record) => (
                          <option value={record.id} key={record.id}>
                            {recordTitle(record)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={fieldId}
                        type={field.kind ?? 'text'}
                        min={field.kind === 'number' ? 0 : undefined}
                        required={field.required}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    )}
                  </>
                )}
                {field.help && <span className="field-help">{field.help}</span>}
                {fieldErrors[field.name] && (
                  <span className="field-error" role="alert">
                    {fieldErrors[field.name]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {error && (
          <p className="academic-error" role="alert">
            {error}
          </p>
        )}
        <div className="academic-form-actions">
          <button
            className="primary-button academic-submit"
            type="submit"
            disabled={saving}
          >
            {editingId ? <Save size={16} /> : <Plus size={16} />}
            {saving
              ? 'Saving...'
              : editingId
                ? 'Save changes'
                : `Add ${definition.singular}`}
          </button>
          {editingId && (
            <button className="text-command" type="button" onClick={resetForm}>
              <RotateCcw size={15} /> Cancel
            </button>
          )}
        </div>
      </form>

      <div className="academic-list-heading">
        <div>
          <h2>{definition.label}</h2>
          <span>
            {records.length} {records.length === 1 ? 'record' : 'records'}
          </span>
        </div>
        <button
          className="icon-command"
          type="button"
          onClick={() => void loadRecords()}
          disabled={loading}
          aria-label="Refresh records"
          title="Refresh records"
        >
          <RotateCcw size={16} />
        </button>
      </div>
      {error && !fieldErrors[definition.primaryField] && (
        <p className="academic-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="academic-state">
          Loading {definition.label.toLowerCase()}...
        </p>
      ) : records.length === 0 ? (
        <p className="academic-state">
          No {definition.label.toLowerCase()} yet. Add the first record above.
        </p>
      ) : (
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr>
                <th>
                  {definition.primaryField === 'fullName'
                    ? 'Name'
                    : definition.label.replace(/s$/, '')}
                </th>
                {tableFields.map((field) => (
                  <th key={field.name}>{field.label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const data = record as unknown as Record<string, unknown>;
                return (
                  <tr key={record.id}>
                    <td>
                      <strong>
                        {String(
                          data[definition.primaryField] ?? recordTitle(record),
                        )}
                      </strong>
                      <span className="record-id">{record.id}</span>
                    </td>
                    {tableFields.map((field) => (
                      <td key={field.name}>
                        {formatValue(field, data[field.name], relatedRecords)}
                      </td>
                    ))}
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-command"
                          type="button"
                          onClick={() => beginEdit(record)}
                          aria-label={`Edit ${recordTitle(record)}`}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-command danger-command"
                          type="button"
                          onClick={() => void handleDelete(record)}
                          aria-label={`Delete ${recordTitle(record)}`}
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
