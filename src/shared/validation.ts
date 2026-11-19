import { z } from "zod";
import { MAX_CONTENT_LENGTH } from "./constants";

export const createEntrySchema = z.object({
  content: z
    .string({ error: "일기 내용을 입력해 주세요." })
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "일기 내용을 입력해 주세요.")
        .max(MAX_CONTENT_LENGTH, `일기는 ${MAX_CONTENT_LENGTH}자까지 쓸 수 있어요.`),
    ),
});

export const entryIdSchema = z.uuid("올바르지 않은 일기 번호예요.");

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(20),
  cursor: z.string().max(200).optional(),
});
