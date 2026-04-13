export const KIND_SUMMARY = 'summary';
export const KIND_FILE_UPLOAD = 'file_upload';
export const KIND_TEXT_NOTE = 'text_note';

export function kindLabel(kind: string): string {
  switch (kind) {
    case KIND_FILE_UPLOAD:
      return 'File';
    case KIND_TEXT_NOTE:
      return 'Note';
    case KIND_SUMMARY:
    default:
      return 'Summary';
  }
}
