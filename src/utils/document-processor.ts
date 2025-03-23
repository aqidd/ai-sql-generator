import path from 'path';
import fs from 'fs/promises'; // Import fs/promises for reading .txt files
import { parseOfficeAsync, OfficeParserConfig } from 'officeparser';

export async function extractTextFromFile(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.txt', '.pdf', '.docx', '.pptx'];

    if (!supportedExtensions.includes(ext)) {
        throw new Error('Unsupported file type');
    }

    if (ext === '.txt') {
        // Read .txt files directly using fs
        return await fs.readFile(filePath, 'utf-8');
    }

    const config: OfficeParserConfig = {
        newlineDelimiter: " ",
        ignoreNotes: ext === '.pptx' // Only ignore notes for presentation files
    };

    return await parseOfficeAsync(filePath, config);
}
