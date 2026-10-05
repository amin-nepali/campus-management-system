import { z } from 'zod';

const requiredText = z.string().trim().min(1, 'This field is required.');
const text = z.string().trim();
const isoDateTime = z.string().datetime({ offset: true });

export const noticeStatuses = ['draft', 'published', 'archived'] as const;
export const noticePriorities = ['normal', 'important', 'urgent'] as const;
export const audienceTypes = ['campus', 'class', 'section', 'role'] as const;

export const noticeSchemas = {
  notices: z
    .object({
      campusId: requiredText,
      authorId: requiredText,
      authorName: text,
      title: requiredText.min(3, 'Title must be at least 3 characters.'),
      body: requiredText.min(10, 'Body must be at least 10 characters.'),
      audienceType: z.enum(audienceTypes),
      audienceIds: z.array(z.string()).default([]),
      priority: z.enum(noticePriorities).default('normal'),
      status: z.enum(noticeStatuses).default('draft'),
      publishedAt: isoDateTime.nullable().optional(),
      expiresAt: isoDateTime.nullable().optional(),
    })
    .strict(),
} as const;

export const publishedNoticeSchema = noticeSchemas.notices.refine(
  (notice) => notice.status !== 'published' || notice.publishedAt !== null,
  {
    message: 'Published notices need a publication date.',
    path: ['publishedAt'],
  },
);

export type Notice = z.infer<typeof noticeSchemas.notices> & {
  id: string;
};
export type NoticeInput = z.input<typeof noticeSchemas.notices>;