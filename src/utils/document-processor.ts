import path from 'path';
import { parseOfficeAsync, OfficeParserConfig } from 'officeparser';

export async function extractTextFromFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.txt', '.pdf', '.docx', '.pptx'];

    if (!supportedExtensions.includes(ext)) {
        throw new Error('Unsupported file type');
    }

    const config: OfficeParserConfig = {
        newlineDelimiter: " ",
        ignoreNotes: ext === '.pptx' // Only ignore notes for presentation files
    };

    return await parseOfficeAsync(filePath, config);
}
