
export interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  width?: string;
  height?: string;
  depth?: string;
  units?: 'cm' | 'in';
}
