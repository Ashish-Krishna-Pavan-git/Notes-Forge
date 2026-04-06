# Cross-Platform File Processing

## Scope

NotesForge now includes a dedicated processing workflow at `/processing` for secure `PDF <-> DOCX` conversion across:

- Web deployments
- Windows desktop packaging
- Linux desktop packaging

## Architecture

### Frontend

- Route: `webapp/frontend/src/pages/FileProcessingPage.tsx`
- Responsibilities:
  - drag-and-drop and file picker selection
  - runtime folder selection for detected files
  - preview panel for PDF inputs and outputs
  - local conversion history

### Backend

- Runtime file discovery: `webapp/backend/app/file_access.py`
- Conversion engine: `webapp/backend/app/pdf_conversion.py`
- Public API wiring: `webapp/backend/app/main.py`

## API Endpoints

- `GET /api/file-processing/context`
  - returns runtime target, platform, working directory, detected directories, PDF capability state, output/download paths, and marker-template guidance
- `POST /api/file-processing/convert`
  - accepts either:
    - multipart upload `file`
    - detected runtime source via `detected_directory_key` + `detected_filename`
  - required field: `target_format`
  - optional fields:
    - `provider_preference=auto|local|smallpdf|ilovepdf`
    - `preserve_layout=true|false`
- `POST /api/file-processing/convert/batch`
  - accepts multiple uploaded files and optional detected-file references
  - returns an async job id and ZIP output

## Runtime Strategy

### Web

- default to secure browser uploads
- server-side folder discovery should stay disabled
- browser clients cannot scan local Downloads directly, so drag-drop and file picker remain the supported equivalent
- use backend-held provider integrations or a secure proxy for:
  - `Smallpdf`
  - `iLovePDF`

### Windows / Linux

- keep upload/manual selection available
- optionally enable runtime folder discovery for Downloads/Documents/Desktop/current workspace
- local conversion path prefers:
  - `pdf2docx` for `PDF -> DOCX`
  - existing local DOCX-to-PDF chain for `DOCX -> PDF`

## Environment Variables

- `NF_ENABLE_SERVER_FILE_DISCOVERY`
- `NF_FILE_DISCOVERY_MAX_FILES`
- `NF_PROCESSING_MAX_UPLOAD_BYTES`
- `NF_SMALLPDF_WORD_TO_PDF_URL`
- `NF_SMALLPDF_PDF_TO_WORD_URL`
- `NF_SMALLPDF_AUTH_HEADER`
- `NF_SMALLPDF_AUTH_SCHEME`
- `NF_SMALLPDF_AUTH_TOKEN`
- `NF_ILOVEPDF_WORD_TO_PDF_URL`
- `NF_ILOVEPDF_PDF_TO_WORD_URL`
- `NF_ILOVEPDF_REMOTE_AUTH_HEADER`
- `NF_ILOVEPDF_REMOTE_AUTH_SCHEME`
- `NF_ILOVEPDF_REMOTE_AUTH_TOKEN`
- existing iLovePDF DOCX-to-PDF variables remain supported:
  - `NF_ILOVEPDF_PUBLIC_KEY`
  - `NF_ILOVEPDF_AUTOMATION_URL`
  - `NF_ILOVEPDF_REGION`

## Security Notes

- no fixed absolute paths are required
- uploaded files are written to runtime temp storage only
- detected-file access is restricted to discovered directories and plain filenames
- remote provider URLs are validated before outbound requests
- browser clients never need direct provider credentials
- if high-fidelity PDF support is not ready for a runtime, the UI removes the PDF action instead of leaving a broken control visible

## Example Flow

1. Open `/processing`
2. Upload a `sample.pdf` or select a detected file from Downloads
3. Choose `DOCX`
4. Keep `provider_preference=auto`
5. Convert and download the generated file
6. Optionally continue editing inside the main NotesForge marker workflow
